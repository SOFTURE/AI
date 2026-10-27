import type { AuthUser, PasswordResetDetails, PasswordResetSender } from "@softure-ai/auth";
import { passwordResetJobHandlers, enqueuePasswordReset, PASSWORD_RESET_QUEUE } from "@softure-ai/auth/jobs";
import { deliverPasswordReset, findPasswordResetUser, registerUser, resetPassword } from "@softure-ai/auth/server";
import { jobs } from "@softure-ai/jobs";
import type { JobsLogger } from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createConfig, createTestAuth, NOW, PASSWORD, type TestAuth } from "./support.js";

const EMAIL = "ada@example.com";
const MINUTE_MS = 60 * 1000;
const SILENT: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const JOBS = jobs({ queues: { [PASSWORD_RESET_QUEUE]: { maxAttempts: 3, backoff: { baseSeconds: 10, maxSeconds: 60 } } } });

interface SentLink {
  readonly link: string;
  readonly user: AuthUser;
  readonly details: PasswordResetDetails;
}

describe("password reset through jobs", () => {
  let test: TestAuth;
  let sent: SentLink[];
  let userId: string;

  const recordLink: PasswordResetSender = (link, user, details) => {
    sent.push({ link, user, details });
    return Promise.resolve();
  };

  async function setUp(send: PasswordResetSender = recordLink): Promise<void> {
    sent = [];
    test = await createTestAuth({ auth: { passwordReset: { send, enqueue: enqueuePasswordReset } }, modules: [JOBS] });
    const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    userId = registered.value.user.id;
  }

  function runJobs(): ReturnType<typeof runDueJobs> {
    return runDueJobs(test.ctx, { handlers: passwordResetJobHandlers, logger: SILENT, random: () => 0 });
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await test.database.close();
  });

  it("enqueues the account's id instead of sending, and issues no link in the request", async () => {
    await setUp();
    expect(await deliverPasswordReset(test.ctx, EMAIL)).toBe("queued");
    expect(sent).toEqual([]);
    expect(await countRows(test.database, "password_resets")).toBe(0);
    const [job] = await listJobs(test.database.db);
    expect(job).toMatchObject({ queue: PASSWORD_RESET_QUEUE, payload: { userId }, status: "pending", dedupKey: userId });
    expect(JSON.stringify(job?.payload)).not.toContain(EMAIL);
  });

  it("joins a pending job when the account asks again", async () => {
    await setUp();
    await deliverPasswordReset(test.ctx, EMAIL);
    await deliverPasswordReset(test.ctx, EMAIL);
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it("enqueues nothing for an unknown email", async () => {
    await setUp();
    expect(await deliverPasswordReset(test.ctx, "nobody@example.com")).toBe("no_account");
    expect(await listJobs(test.database.db)).toEqual([]);
  });

  it("sends a link from the job that resets the password, valid for the TTL from the send", async () => {
    await setUp();
    await deliverPasswordReset(test.ctx, EMAIL);
    test.clock.advance(5 * MINUTE_MS);
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.user).toEqual({ id: userId, email: EMAIL, createdAt: NOW, displayName: null });
    expect(sent[0]?.details).toEqual({ expiresAt: new Date(NOW.getTime() + 65 * MINUTE_MS), locale: "en" });
    const token = new URL(sent[0]?.link ?? "").searchParams.get("token") ?? "";
    expect((await resetPassword(test.ctx, { token, newPassword: "a brand new passphrase", clientKey: CLIENT })).ok).toBe(true);
  });

  it("ends without a mail when the account is gone", async () => {
    await setUp();
    await deliverPasswordReset(test.ctx, EMAIL);
    await test.database.client.query("DELETE FROM auth.users");
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(sent).toEqual([]);
  });

  it("retries a failing sender with a fresh link each time and logs no link", async () => {
    const links: string[] = [];
    let calls = 0;
    await setUp((link) => {
      links.push(link);
      calls += 1;
      return calls === 1 ? Promise.reject(new Error(`provider down for ${link}`)) : Promise.resolve();
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await deliverPasswordReset(test.ctx, EMAIL);

    expect(await runJobs()).toEqual({ succeeded: 0, retried: 1, failed: 0, stale: 0 });
    const [job] = await listJobs(test.database.db);
    expect(job).toMatchObject({ status: "pending", lastError: "auth.password_reset_send_failed" });
    expect(errors.mock.calls.flat().join(" ")).not.toContain("token=");

    test.clock.advance(10 * 1000);
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(links).toHaveLength(2);
    expect(links[0]).not.toBe(links[1]);
    const [first, second] = links.map((link) => new URL(link).searchParams.get("token") ?? "");
    expect(await findPasswordResetUser(test.ctx, first ?? "")).toBeNull();
    expect((await findPasswordResetUser(test.ctx, second ?? ""))?.id).toBe(userId);
  });
});

describe("auth options with a reset enqueuer", () => {
  it("refuse it without a sender", () => {
    expect(() => createConfig({ auth: { passwordReset: { enqueue: enqueuePasswordReset } }, modules: [JOBS] })).toThrow(/passwordReset\.enqueue/);
  });
});
