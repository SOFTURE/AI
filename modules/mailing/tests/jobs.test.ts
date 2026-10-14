// Deliveries through @softure-ai/jobs: enqueued with the caller's write, sent by the job, retried while the provider
// is unavailable, and sent once however often the job runs.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { jobs, type JobHandlers } from "@softure-ai/jobs";
import { enqueueJob, type JobsContext } from "@softure-ai/jobs/server";
import { listJobs, runDueJobs, type RunDueJobsReport } from "@softure-ai/jobs/testing";
import { mailing, type OutgoingMail, type ProviderOutcome } from "@softure-ai/mailing";
import { defineDeliveryJobHandler, enqueueDelivery, getDeliveryJobResult } from "@softure-ai/mailing/jobs";
import { deliverOnce, getRecipientKey } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { z } from "zod";
import { FROM, MAIL, NOW } from "./support.js";

const QUEUE = "mail.welcome";
const SCOPE = "app.welcome:user_7";
const BACKOFF_SECONDS = 10;
const STALE_CLAIM_SECONDS = 15 * 60;
const ADA_KEY = getRecipientKey(MAIL.to);

type Respond = (message: unknown) => Exclude<ProviderOutcome, { status: "sent" }> | undefined;

interface TestDeliveryJobs {
  readonly ctx: JobsContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly provider: FakeMailProvider;
  readonly respond: ReturnType<typeof vi.fn<Respond>>;
  readonly buildMail: ReturnType<typeof vi.fn<(payload: { userId: string }) => Promise<OutgoingMail | null>>>;
  readonly run: () => Promise<RunDueJobsReport>;
}

async function createTestDeliveryJobs(maxAttempts = 3): Promise<TestDeliveryJobs> {
  const respond = vi.fn<Respond>(() => undefined);
  const provider = fakeMailProvider({ respond });
  const config: SoftureConfig = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [
      jobs({ queues: { [QUEUE]: { maxAttempts, backoff: { baseSeconds: BACKOFF_SECONDS, maxSeconds: 600 } } } }),
      mailing({ from: FROM, provider }),
    ],
  });
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  const ctx = { db: database.db, clock, config };
  const buildMail = vi.fn((payload: { userId: string }) => Promise.resolve<OutgoingMail | null>({ ...MAIL, text: `Welcome, ${payload.userId}` }));
  const handlers: JobHandlers = {
    [QUEUE]: defineDeliveryJobHandler({ payload: z.object({ userId: z.string() }), buildMail }),
  };
  const run = () => runDueJobs(ctx, { handlers, random: () => 0 });
  return { ctx, clock, database, provider, respond, buildMail, run };
}

async function readLedger(test: TestDeliveryJobs): Promise<{ status: string; attempts: number }[]> {
  const result = await test.database.client.query<{ status: string; attempts: number }>("SELECT status, attempts FROM mailing.deliveries");
  return result.rows;
}

function secondsFromNow(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

describe("deliveries through jobs", () => {
  let test: TestDeliveryJobs;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    test = await createTestDeliveryJobs();
  });
  afterEach(async () => {
    log.mockRestore();
    await test.database.close();
  });

  it("enqueues with the caller's transaction and sends from the job, with ids in the payload and never the mail", async () => {
    await test.ctx.db.transaction(async (tx) => {
      await enqueueDelivery({ ...test.ctx, db: tx }, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    });
    expect(await test.run()).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });

    expect(test.provider.sent).toMatchObject([{ to: MAIL.to, text: "Welcome, user_7", idempotencyKey: `${SCOPE}:${ADA_KEY}` }]);
    expect(test.buildMail).toHaveBeenCalledWith({ userId: "user_7" }, expect.objectContaining({ scope: SCOPE }));
    const [job] = await listJobs(test.ctx.db);
    expect(job).toMatchObject({ status: "succeeded", attempts: 1, dedupKey: SCOPE, payload: { scope: SCOPE, payload: { userId: "user_7" } } });
    expect(JSON.stringify(job?.payload)).not.toContain(MAIL.to);
    expect(await readLedger(test)).toEqual([{ status: "sent", attempts: 1 }]);
  });

  it("leaves no job behind when the caller's transaction rolls back", async () => {
    await expect(
      test.ctx.db.transaction(async (tx) => {
        await enqueueDelivery({ ...test.ctx, db: tx }, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
        throw new Error("the signup failed");
      }),
    ).rejects.toThrow("the signup failed");
    expect(await listJobs(test.ctx.db)).toEqual([]);
  });

  it("returns the live job for a second enqueue of the same scope", async () => {
    const first = await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    const second = await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    expect(second).toEqual({ id: first.id, isDuplicate: true });
  });

  it("passes the due time and the attempt limit to the job", async () => {
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" }, delaySeconds: 60, maxAttempts: 9 });
    expect(await listJobs(test.ctx.db)).toMatchObject([{ runAt: secondsFromNow(60), maxAttempts: 9 }]);
  });

  it.each([["App.Welcome:1"], ["app welcome"], ["x".repeat(129)]])("refuses the malformed scope %j", async (scope) => {
    await expect(enqueueDelivery(test.ctx, { queue: QUEUE, scope, payload: {} })).rejects.toThrow(`enqueueDelivery scope "${scope}"`);
    expect(await listJobs(test.ctx.db)).toEqual([]);
  });

  it("retries an unavailable provider with the queue's backoff and sends once with the same key", async () => {
    test.respond.mockReturnValueOnce({ status: "unavailable", httpStatus: 503 });
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    expect(await test.run()).toEqual({ succeeded: 0, retried: 1, failed: 0, stale: 0 });
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "pending", lastError: "mailing.unavailable", runAt: secondsFromNow(BACKOFF_SECONDS) }]);
    expect(await readLedger(test)).toEqual([{ status: "pending", attempts: 1 }]);

    test.clock.advance(BACKOFF_SECONDS * 1000);
    expect(await test.run()).toMatchObject({ succeeded: 1 });
    expect(test.respond.mock.calls).toHaveLength(2);
    expect(test.provider.sent).toHaveLength(1);
    expect(await readLedger(test)).toEqual([{ status: "sent", attempts: 2 }]);
  });

  it.each([
    ["an unavailable provider", { status: "unavailable", httpStatus: 429, retryAfterSeconds: 30 }, "mailing.unavailable"],
    ["a spent quota", { status: "quota_exceeded", httpStatus: 429, retryAfterSeconds: 3600 }, "mailing.quota_exceeded"],
    ["a refused account", { status: "refused", httpStatus: 401, retryAfterSeconds: 120 }, "mailing.provider_refused"],
  ] as const)("retries %s after the provider's Retry-After", async (_case, outcome, code) => {
    test.respond.mockReturnValueOnce(outcome);
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "pending", lastError: code, runAt: secondsFromNow(outcome.retryAfterSeconds) }]);
  });

  it.each([
    ["a spent quota", { status: "quota_exceeded", httpStatus: 429 }, "mailing.quota_exceeded"],
    ["a refused account", { status: "refused", httpStatus: 403 }, "mailing.provider_refused"],
  ] as const)("retries %s without a Retry-After with the queue's backoff", async (_case, outcome, code) => {
    test.respond.mockReturnValueOnce(outcome);
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "pending", lastError: code, runAt: secondsFromNow(BACKOFF_SECONDS) }]);
    expect(await readLedger(test)).toEqual([{ status: "pending", attempts: 0 }]);
  });

  it("fails the job at once when the provider rejects the mail", async () => {
    test.respond.mockReturnValueOnce({ status: "rejected", httpStatus: 422 });
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    expect(await test.run()).toMatchObject({ failed: 1 });
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "failed", attempts: 1, lastError: "mailing.rejected" }]);
    expect(await readLedger(test)).toEqual([{ status: "rejected", attempts: 1 }]);
  });

  it("fails the job at once for an invalid mail", async () => {
    test.buildMail.mockResolvedValueOnce({ ...MAIL, to: "not an address" });
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "failed", lastError: "mailing.invalid_input" }]);
  });

  it("succeeds without sending when there is nothing to send any more", async () => {
    test.buildMail.mockResolvedValueOnce(null);
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    expect(await test.run()).toMatchObject({ succeeded: 1 });
    expect(test.provider.sent).toEqual([]);
    expect(await readLedger(test)).toEqual([]);
  });

  it("sends nothing again when the ledger already closed the delivery", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    expect(await test.run()).toMatchObject({ succeeded: 1 });
    expect(test.provider.sent).toHaveLength(1);
  });

  it("waits for another sender's fresh claim until it could be stale", async () => {
    await test.database.client.query(
      "INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at) VALUES ($1, $2, 'transactional', 'claimed', 1, $3, $3)",
      [SCOPE, ADA_KEY, NOW],
    );
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([
      { status: "pending", lastError: "mailing.delivery_in_flight", runAt: secondsFromNow(STALE_CLAIM_SECONDS) },
    ]);

    test.clock.advance(STALE_CLAIM_SECONDS * 1000 + 1);
    expect(await test.run()).toMatchObject({ succeeded: 1 });
    expect(test.provider.sent).toHaveLength(1);
  });

  it("fails an uncertain delivery for the operator to decide", async () => {
    const dayAgo = new Date(NOW.getTime() - 24 * 60 * 60_000);
    await test.database.client.query(
      "INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at) VALUES ($1, $2, 'transactional', 'claimed', 1, $3, $3)",
      [SCOPE, ADA_KEY, dayAgo],
    );
    await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "failed", lastError: "mailing.delivery_uncertain" }]);
    expect(test.respond).not.toHaveBeenCalled();
  });

  it("fails a job whose payload has no valid scope, untried", async () => {
    await enqueueJob(test.ctx, { queue: QUEUE, payload: { scope: "Not A Scope", payload: { userId: "user_7" } } });
    await test.run();
    expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "failed", lastError: "jobs.invalid_payload" }]);
    expect(test.buildMail).not.toHaveBeenCalled();
  });
});

describe("attempts", () => {
  it("are counted by the job, not by the ledger: more unavailable answers than the ledger's limit still end in a send", async () => {
    const test = await createTestDeliveryJobs(8);
    try {
      test.respond.mockReturnValue({ status: "unavailable" });
      await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
      for (let round = 0; round < 6; round += 1) {
        await test.run();
        test.clock.advance(600_000);
      }
      expect(await readLedger(test)).toEqual([{ status: "pending", attempts: 6 }]);

      test.respond.mockReturnValue(undefined);
      expect(await test.run()).toMatchObject({ succeeded: 1 });
      expect(await readLedger(test)).toEqual([{ status: "sent", attempts: 7 }]);
    } finally {
      await test.database.close();
    }
  });

  it("end in a failed job that leaves the ledger open for a later retry", async () => {
    const test = await createTestDeliveryJobs(2);
    try {
      test.respond.mockReturnValue({ status: "unavailable" });
      await enqueueDelivery(test.ctx, { queue: QUEUE, scope: SCOPE, payload: { userId: "user_7" } });
      await test.run();
      test.clock.advance(600_000);
      await test.run();
      expect(await listJobs(test.ctx.db)).toMatchObject([{ status: "failed", attempts: 2, lastError: "mailing.unavailable" }]);
      expect(await readLedger(test)).toEqual([{ status: "pending", attempts: 2 }]);
    } finally {
      await test.database.close();
    }
  });
});

describe("getDeliveryJobResult", () => {
  const options = { staleClaimMs: 90_500 };

  it.each([
    [{ status: "sent", id: "msg_1" }, { ok: true, value: undefined }],
    [{ status: "done", outcome: "rejected" }, { ok: true, value: undefined }],
    [{ status: "rejected", reason: "mailing.suppressed" }, { ok: false, error: "mailing.suppressed", retry: false }],
    [{ status: "retry-later" }, { ok: false, error: "mailing.unavailable" }],
    [{ status: "retry-later", retryAfterSeconds: 5 }, { ok: false, error: "mailing.unavailable", retryAfterSeconds: 5 }],
    [{ status: "halted", reason: "mailing.quota_exceeded", retryAfterSeconds: 60 }, { ok: false, error: "mailing.quota_exceeded", retryAfterSeconds: 60 }],
    [{ status: "in-flight" }, { ok: false, error: "mailing.delivery_in_flight", retryAfterSeconds: 91 }],
    [{ status: "uncertain" }, { ok: false, error: "mailing.delivery_uncertain", retry: false }],
  ] as const)("maps %j to %j", (outcome, result) => {
    expect(getDeliveryJobResult(outcome, options)).toEqual(result);
  });
});
