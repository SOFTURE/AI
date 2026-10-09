// runDeliveries: one mail per recipient through the ledger, with a limit, a pause, a halt on the account and a dry run.
import type { MailingErrorCode } from "@softure-ai/mailing";
import { deliverOnce, runDeliveries, suppressRecipient, type Delivery, type DeliveryOutcome } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, SECRET, type TestMailing } from "./support.js";

interface Subscription {
  readonly id: string;
  readonly email: string;
}

const SUBSCRIPTIONS: readonly Subscription[] = [
  { id: "sub_1", email: "ada@example.org" },
  { id: "sub_2", email: "bob@example.org" },
  { id: "sub_3", email: "cy@example.org" },
];
const NO_REJECTIONS: Record<MailingErrorCode, number> = {
  "mailing.invalid_input": 0,
  "mailing.rejected": 0,
  "mailing.unavailable": 0,
  "mailing.suppressed": 0,
  "mailing.provider_refused": 0,
  "mailing.quota_exceeded": 0,
};
const EMPTY_SUMMARY = {
  dryRun: false,
  recipients: 0,
  skipped: 0,
  sent: 0,
  rejected: NO_REJECTIONS,
  done: 0,
  inFlight: 0,
  retryLater: 0,
  uncertain: 0,
  halted: null,
  remaining: 0,
};

function buildTrialEnding(subscription: Subscription): Delivery {
  return {
    scope: `billing.trial-ending:${subscription.id}`,
    mail: { to: subscription.email, subject: "Your trial ends soon", text: `Hello, your trial ${subscription.id} ends soon.`, kind: "lifecycle" },
  };
}

async function countLedger(test: TestMailing): Promise<Record<string, number>> {
  const result = await test.database.client.query<{ status: string; count: number }>("SELECT status, count(*)::int AS count FROM mailing.deliveries GROUP BY status ORDER BY status");
  return Object.fromEntries(result.rows.map((row) => [row.status, row.count]));
}

describe("runDeliveries", () => {
  let provider: FakeMailProvider;
  let respond: ReturnType<typeof vi.fn<NonNullable<Parameters<typeof fakeMailProvider>[0]>["respond"] & object>>;
  let test: TestMailing;

  beforeEach(async () => {
    respond = vi.fn<NonNullable<Parameters<typeof fakeMailProvider>[0]>["respond"] & object>(() => undefined);
    provider = fakeMailProvider({ respond });
    test = await createTestMailing(createConfig(provider));
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await test.database.close();
  });

  it("sends the mail each recipient's build returns, once, and a re-run sends nothing", async () => {
    const first = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding });
    const second = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding });

    expect(first).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 3 });
    expect(second).toEqual({ ...EMPTY_SUMMARY, recipients: 3, done: 3 });
    expect(provider.sent.map((mail) => [mail.to, mail.subject])).toEqual([
      ["ada@example.org", "Your trial ends soon"],
      ["bob@example.org", "Your trial ends soon"],
      ["cy@example.org", "Your trial ends soon"],
    ]);
    expect(await countLedger(test)).toEqual({ sent: 3 });
  });

  it("skips a recipient whose build returns null and stores nothing for it", async () => {
    const summary = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: (subscription) => (subscription.id === "sub_2" ? null : buildTrialEnding(subscription)) });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, recipients: 3, skipped: 1, sent: 2 });
    expect(await countLedger(test)).toEqual({ sent: 2 });
  });

  it("takes recipients from an async iterable and an async build", async () => {
    async function* listDue(): AsyncIterable<Subscription> {
      for (const subscription of SUBSCRIPTIONS) yield await Promise.resolve(subscription);
    }
    const summary = await runDeliveries(test.ctx, { recipients: listDue(), build: (subscription) => Promise.resolve(buildTrialEnding(subscription)) });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 3 });
  });

  it("counts a suppressed recipient of list mail as rejected and sends to the rest", async () => {
    await suppressRecipient(test.ctx, "bob@example.org");

    const summary = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 2, rejected: { ...NO_REJECTIONS, "mailing.suppressed": 1 } });
  });

  it.each([
    ["a refused account", { status: "refused", httpStatus: 401 } as const, "mailing.provider_refused", 401],
    ["a spent quota", { status: "quota_exceeded", httpStatus: 429 } as const, "mailing.quota_exceeded", 429],
  ])("stops at %s, leaves the rest untouched, and the next run sends them", async (_name, failure, reason, httpStatus) => {
    respond.mockImplementation((message) => (message.to === "bob@example.org" ? failure : undefined));

    const halted = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding });

    expect(halted).toEqual({ ...EMPTY_SUMMARY, recipients: 2, sent: 1, retryLater: 1, halted: { reason, httpStatus }, remaining: null });
    expect(await countLedger(test)).toEqual({ pending: 1, sent: 1 });

    respond.mockImplementation(() => undefined);
    const resumed = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding });
    expect(resumed).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 2, done: 1 });
  });

  it("hands at most limit mails to the provider and counts the rest that the next run would send", async () => {
    const summary = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding }, { limit: 1 });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 1, remaining: 2 });
    expect(provider.sent).toHaveLength(1);
    expect(await countLedger(test)).toEqual({ sent: 1 });
  });

  it("does not count past the limit what the ledger already closed", async () => {
    await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS.slice(1), build: buildTrialEnding });

    const summary = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding }, { limit: 1 });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, recipients: 3, sent: 1, remaining: 0 });
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses limit %s with a RangeError before anything is sent", async (limit) => {
    await expect(runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding }, { limit })).rejects.toThrow(RangeError);
    expect(provider.sent).toEqual([]);
  });

  it("pauses after every mail the provider took, and not after one the ledger skipped", async () => {
    await deliverOnce(test.ctx, buildTrialEnding(SUBSCRIPTIONS[0] as Subscription));
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const outcomes: DeliveryOutcome[] = [];

    await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding }, { pauseMs: 250, sleep, onDelivery: (outcome) => outcomes.push(outcome) });

    expect(sleep.mock.calls).toEqual([[250], [250]]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["done", "sent", "sent"]);
  });

  it("dry run: counts what a run would do and writes and sends nothing", async () => {
    await deliverOnce(test.ctx, buildTrialEnding(SUBSCRIPTIONS[0] as Subscription));
    await suppressRecipient(test.ctx, "bob@example.org");
    const [ada, bob, cy] = SUBSCRIPTIONS as [Subscription, Subscription, Subscription];
    const recipients = [ada, bob, { id: "sub_4", email: "not an address" }, cy, { id: "sub_5", email: "dee@example.org" }];
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());

    const summary = await runDeliveries(test.ctx, { recipients, build: buildTrialEnding }, { dryRun: true, limit: 1, pauseMs: 250, sleep });

    expect(summary).toEqual({
      ...EMPTY_SUMMARY,
      dryRun: true,
      recipients: 5,
      sent: 1,
      done: 1,
      rejected: { ...NO_REJECTIONS, "mailing.suppressed": 1, "mailing.invalid_input": 1 },
      remaining: 1,
    });
    expect(provider.sent).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(await countLedger(test)).toEqual({ sent: 1 });
  });

  it("dry run: a second delivery of the same scope and recipient counts as done", async () => {
    const summary = await runDeliveries(test.ctx, { recipients: [SUBSCRIPTIONS[0] as Subscription, SUBSCRIPTIONS[0] as Subscription], build: buildTrialEnding }, { dryRun: true });

    expect(summary).toEqual({ ...EMPTY_SUMMARY, dryRun: true, recipients: 2, sent: 1, done: 1 });
  });

  it.each([false, true])("refuses list mail without the unsubscribe secret before anything is claimed (dry run %s)", async (dryRun) => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "");

    await expect(runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: buildTrialEnding }, { dryRun })).rejects.toThrow("needs MAILING_UNSUBSCRIBE_SECRET");
    expect(provider.sent).toEqual([]);
    expect(await countLedger(test)).toEqual({});
  });

  it("sends transactional mail without the unsubscribe secret", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "");
    const summary = await runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: (subscription) => ({ ...buildTrialEnding(subscription), mail: { ...buildTrialEnding(subscription).mail, kind: "transactional" } }) });
    expect(summary.sent).toBe(3);
  });

  it("dry run: refuses a malformed scope like a real run", async () => {
    await expect(runDeliveries(test.ctx, { recipients: SUBSCRIPTIONS, build: (subscription) => ({ ...buildTrialEnding(subscription), scope: "Not A Scope" }) }, { dryRun: true })).rejects.toThrow(
      /scope "Not A Scope"/,
    );
  });
});
