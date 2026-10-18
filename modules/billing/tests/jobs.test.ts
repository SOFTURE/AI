// The jobs adapter: the daily schedules run the access reminder mail and the invoice request expiry through their
// handlers; a mail outage is retried without a second mail, a refused sending account fails the run.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { billing, BILLING_RATE_LIMIT_BUCKETS, type BillingOptionsInput } from "@softure-ai/billing";
import { billingJobHandlers, billingJobSchedules, createBillingJobHandlers } from "@softure-ai/billing/jobs";
import { listOpenRequests, recordPaymentRequest } from "@softure-ai/billing/server";
import { createTestClock, defineSoftureConfig } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { headerIp, security } from "@softure-ai/security";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, NOW, TIMEZONE, type TestBilling } from "./support.js";

/** 14 October, 10:00 in Warsaw: day 12 of 14, inside the 3-day trial reminder window. */
const IN_TRIAL_WINDOW = new Date("2026-10-14T08:00:00Z");
const HOUR_MS = 3_600_000;
const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
const NO_PAUSE = { reminders: { pauseMs: 0 } };

let current: TestBilling | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

async function setUp(provider: FakeMailProvider = fakeMailProvider()): Promise<TestBilling> {
  const config = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: TIMEZONE,
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS, ...BILLING_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } }, requireConsent: false }),
      privacy(),
      mailing({ from: "hello@example.com", provider }),
      billing({ plans: PLANS, trial: { days: 14, reminderDays: 3 } }),
      jobs({ schedules: billingJobSchedules }),
    ],
  });
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  current = { ctx: { db: database.db, clock, config }, clock, database, config };
  return current;
}

async function listJobStatuses(test: TestBilling): Promise<Record<string, string>> {
  return Object.fromEntries((await listJobs(test.database.db)).map((job) => [job.queue, job.status]));
}

describe("the billing jobs", () => {
  it("schedules a handler for every queue it names, daily", () => {
    expect(Object.keys(billingJobSchedules)).toEqual(Object.keys(billingJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: billingJobSchedules }).schedules).toEqual({
      "billing.access-reminders": { every: "1d", payload: {} },
      "billing.expire-requests": { every: "1d", payload: {} },
    });
  });

  it("mails the due reminders and expires stale invoice requests on their schedules", async () => {
    const provider = fakeMailProvider();
    const test = await setUp(provider);
    const adaId = await createAccount(test, "ada@example.com");
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: null, price: { amount: 2900, currency: "PLN" } });
    test.clock.set(IN_TRIAL_WINDOW);
    const handlers = createBillingJobHandlers(NO_PAUSE);

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(provider.sent.map((mail) => [mail.to, mail.subject])).toEqual([["ada@example.com", "Your trial ends on October 16, 2026"]]);
    expect(await listOpenRequests(test.ctx)).toHaveLength(1);

    // A month later (after the trial ended and its catch-up days) the request is past its 30 days; no new mail.
    test.clock.set(new Date("2026-11-03T08:00:00Z"));
    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(await listOpenRequests(test.ctx)).toEqual([]);
    expect(provider.sent).toHaveLength(1);
  });

  it("retries a reminder run hit by a mail outage and sends each mail once", async () => {
    let isDown = true;
    const provider = fakeMailProvider({ respond: () => (isDown ? { status: "unavailable" } : undefined) });
    const test = await setUp(provider);
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const handlers = createBillingJobHandlers(NO_PAUSE);

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 1, retried: 1, failed: 0, stale: 0 });
    expect(await listJobStatuses(test)).toEqual({ "billing.access-reminders": "pending", "billing.expire-requests": "succeeded" });
    isDown = false;
    test.clock.advance(HOUR_MS);

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(provider.sent.map((mail) => mail.to).toSorted()).toEqual(["ada@example.com", "bob@example.com"]);
  });

  it("fails a reminder run at a refused sending account, and the next day resumes", async () => {
    let isRefused = true;
    const provider = fakeMailProvider({ respond: () => (isRefused ? { status: "refused", httpStatus: 401 } : undefined) });
    const test = await setUp(provider);
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const handlers = createBillingJobHandlers(NO_PAUSE);

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 1, retried: 0, failed: 1, stale: 0 });
    const failed = (await listJobs(test.database.db)).find((job) => job.queue === "billing.access-reminders");
    expect(failed).toMatchObject({ status: "failed", lastError: "mailing.provider_refused" });
    isRefused = false;
    test.clock.advance(24 * HOUR_MS);

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.com"]);
  });

  it("passes the app's reminder options to every run", async () => {
    const provider = fakeMailProvider();
    const test = await setUp(provider);
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const handlers = createBillingJobHandlers({ reminders: { pauseMs: 0, buildMail: ({ lastDay }) => ({ subject: `Last day: ${lastDay}`, text: "Pay." }) } });

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(provider.sent.map((mail) => mail.subject)).toEqual(["Last day: October 16, 2026"]);
  });

  it("gives the reminder template the job's database and clock", async () => {
    const provider = fakeMailProvider();
    const test = await setUp(provider);
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const handlers = createBillingJobHandlers({
      reminders: {
        pauseMs: 0,
        buildMail: async ({ reminder, ctx }) => {
          const result = await ctx.db.execute<{ email: string }>(sql`select email from auth.users where id = ${reminder.userId}`);
          return { subject: `${result.rows[0]?.email ?? "unknown"} at ${ctx.clock.now().toISOString()}`, text: "Pay." };
        },
      },
    });

    expect(await runDueJobs(test.ctx, { handlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(provider.sent.map((mail) => mail.subject)).toEqual([`ada@example.com at ${IN_TRIAL_WINDOW.toISOString()}`]);
  });
});
