// The confirmation mail through jobs: the join enqueues the sign-up's id in its own transaction, and
// the job mails a fresh link that replaces the join's token, with retry on a provider outage.
import { jobs } from "@softure-ai/jobs";
import type { JobsLogger } from "@softure-ai/jobs/server";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { CONFIRMATION_MAIL_QUEUE, enqueueConfirmationMail, waitlistJobHandlers } from "@softure-ai/waitlist/jobs";
import { confirmSignup, joinWaitlist, listSignups, type JoinWaitlistInput, type PendingSignup } from "@softure-ai/waitlist/server";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createConfig, createTestWaitlist, OPTIONS, type TestWaitlist } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;
const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };
const SILENT: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const JOBS = jobs({ queues: { [CONFIRMATION_MAIL_QUEUE]: { maxAttempts: 3, backoff: { baseSeconds: 10, maxSeconds: 60 } } } });
const QUEUED = { ...OPTIONS, doubleOptIn: true, confirmationMail: { enqueue: enqueueConfirmationMail } };

describe("the confirmation mail through jobs", () => {
  let test: TestWaitlist;

  async function setUp(provider = fakeMailProvider()): Promise<void> {
    test = await createTestWaitlist({ waitlist: QUEUED, modules: [JOBS] }, provider);
  }

  async function requestSignup(): Promise<PendingSignup> {
    const result = await joinWaitlist(test.ctx, JOIN);
    if (!result.ok || result.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
    return result.value;
  }

  function runJobs(): ReturnType<typeof runDueJobs> {
    return runDueJobs(test.ctx, { handlers: waitlistJobHandlers, logger: SILENT, random: () => 0 });
  }

  function sentToken(index: number): string {
    const link = /https:\/\/\S+/.exec(test.provider.sent[index]?.text ?? "")?.[0] ?? "";
    return new URL(link).searchParams.get("token") ?? "";
  }

  afterEach(async () => {
    await test.database.close();
  });

  it("enqueues the sign-up's id with the request and sends nothing in it", async () => {
    await setUp();
    const pending = await requestSignup();
    expect(pending.isMailQueued).toBe(true);
    expect(test.provider.sent).toEqual([]);
    const [job] = await listJobs(test.database.db);
    expect(job).toMatchObject({ queue: CONFIRMATION_MAIL_QUEUE, payload: { signupId: pending.signup.id }, status: "pending", dedupKey: pending.signup.id });
    expect(JSON.stringify(job?.payload)).not.toContain(ADA);
    expect(JSON.stringify(job?.payload)).not.toContain(pending.token);
  });

  it("enqueues in the join's transaction: a rolled-back join leaves no job", async () => {
    test = await createTestWaitlist(
      {
        waitlist: {
          ...QUEUED,
          confirmationMail: {
            enqueue: async (ctx, signupId) => {
              await enqueueConfirmationMail(ctx, signupId);
              throw new Error("the app's write failed");
            },
          },
        },
        modules: [JOBS],
      },
      fakeMailProvider(),
    );
    await expect(joinWaitlist(test.ctx, JOIN)).rejects.toThrow("the app's write failed");
    expect(await listJobs(test.database.db)).toEqual([]);
  });

  it("joins a pending job when the address signs up again", async () => {
    await setUp();
    await requestSignup();
    await requestSignup();
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it("mails a fresh link that confirms, while the join's token no longer does", async () => {
    await setUp();
    const pending = await requestSignup();
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });

    expect(test.provider.sent).toHaveLength(1);
    expect(test.provider.sent[0]?.to).toBe(ADA);
    const token = sentToken(0);
    expect(token).not.toBe(pending.token);
    expect(await confirmSignup(test.ctx, { token: pending.token, clientKey: CLIENT })).toEqual({ ok: false, error: "waitlist.confirmation_invalid" });
    expect(await confirmSignup(test.ctx, { token, clientKey: CLIENT })).toMatchObject({ ok: true, value: { isFirstConfirmation: true } });
    expect(await listSignups(test.ctx)).toHaveLength(1);
  });

  it("ends without a mail for a sign-up confirmed or expired before the job ran", async () => {
    await setUp();
    await requestSignup();
    test.clock.advance(169 * HOUR_MS);
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(test.provider.sent).toEqual([]);
  });

  it("retries a provider outage with a new link and fails a rejected mail", async () => {
    let outages = 1;
    await setUp(fakeMailProvider({ respond: () => (outages-- > 0 ? { status: "unavailable" } : undefined) }));
    await requestSignup();
    expect(await runJobs()).toEqual({ succeeded: 0, retried: 1, failed: 0, stale: 0 });
    expect(await listJobs(test.database.db)).toMatchObject([{ status: "pending", lastError: "mailing.unavailable" }]);
    test.clock.advance(10 * 1000);
    expect(await runJobs()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect((await confirmSignup(test.ctx, { token: sentToken(0), clientKey: CLIENT })).ok).toBe(true);
  });

  it("fails a mail the provider rejects, without retry", async () => {
    await setUp(fakeMailProvider({ respond: () => ({ status: "rejected" }) }));
    await requestSignup();
    expect(await runJobs()).toEqual({ succeeded: 0, retried: 0, failed: 1, stale: 0 });
    expect(await listJobs(test.database.db)).toMatchObject([{ status: "failed", lastError: "mailing.rejected" }]);
  });
});

describe("waitlist options with a confirmation mail enqueuer", () => {
  it("refuse it without double opt-in", () => {
    expect(() => createConfig(fakeMailProvider(), { waitlist: { ...OPTIONS, confirmationMail: { enqueue: enqueueConfirmationMail } }, modules: [JOBS] })).toThrow(
      /confirmationMail\.enqueue/,
    );
  });
});
