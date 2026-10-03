// The delivery ledger: one claim, one outcome per scope and recipient, re-runs send nothing.
import type { OutgoingMail } from "@softure-ai/mailing";
import { deliverOnce, getRecipientKey } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, MAIL, NOW, SECRET, type TestMailing } from "./support.js";

const SCOPE = "billing.trial-ending:sub_42";
const ADA_KEY = getRecipientKey(MAIL.to);
const LIST_MAIL: OutgoingMail = { ...MAIL, kind: "newsletter" };

interface LedgerRow {
  scope: string;
  recipient_key: string;
  kind: string;
  campaign_id: string | null;
  status: string;
  attempts: number;
  claimed_at: Date;
  finished_at: Date | null;
  provider_message_id: string | null;
  reason: string | null;
}

async function listLedger(test: TestMailing): Promise<LedgerRow[]> {
  const result = await test.database.client.query<LedgerRow>(
    "SELECT scope, recipient_key, kind, campaign_id, status, attempts, claimed_at, finished_at, provider_message_id, reason FROM mailing.deliveries ORDER BY scope, recipient_key",
  );
  return result.rows;
}

describe("deliverOnce", () => {
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

  it("sends the mail with an idempotency key of scope and recipient key, and records it as sent", async () => {
    const outcome = await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.idempotencyKey).toBe(`${SCOPE}:${ADA_KEY}`);
    expect(outcome).toEqual({ status: "sent", id: provider.sent[0]?.id });
    expect(await listLedger(test)).toEqual([
      {
        scope: SCOPE,
        recipient_key: ADA_KEY,
        kind: "transactional",
        campaign_id: null,
        status: "sent",
        attempts: 1,
        claimed_at: NOW,
        finished_at: NOW,
        provider_message_id: provider.sent[0]?.id,
        reason: null,
      },
    ]);
  });

  it("sends nothing the second time, whatever the case or spacing of the address", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: { ...MAIL, to: "  ADA@example.org " } })).toEqual({ status: "done", outcome: "sent" });
    expect(provider.sent).toHaveLength(1);
  });

  it("keeps scopes apart: the same recipient gets one mail per scope", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    await deliverOnce(test.ctx, { scope: "billing.trial-ending:sub_43", mail: MAIL });
    expect(provider.sent).toHaveLength(2);
  });

  it("records the kind of list mail and sends it with the unsubscribe headers", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: LIST_MAIL });
    expect((await listLedger(test))[0]?.kind).toBe("newsletter");
    expect(provider.sent[0]?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("closes the delivery as rejected when the provider refuses it, and never retries", async () => {
    const reason = "mailing.rejected";
    respond.mockReturnValue({ status: "rejected", httpStatus: 422 });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).toEqual({ status: "rejected", reason });
    respond.mockReturnValue(undefined);
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).toEqual({ status: "done", outcome: "rejected" });
    expect(respond).toHaveBeenCalledTimes(1);
    expect(await listLedger(test)).toMatchObject([{ status: "rejected", reason, finished_at: NOW, provider_message_id: null }]);
  });

  it("closes a suppressed recipient as rejected without calling the provider, and never retries", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions (recipient_key, source, created_at) VALUES ($1, 'page', $2)", [ADA_KEY, NOW]);
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: LIST_MAIL })).toEqual({ status: "rejected", reason: "mailing.suppressed" });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: LIST_MAIL })).toEqual({ status: "done", outcome: "rejected" });
    expect(respond).not.toHaveBeenCalled();
  });

  it("closes an invalid address as rejected", async () => {
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: { ...MAIL, to: "not an address" } })).toEqual({ status: "rejected", reason: "mailing.invalid_input" });
    expect(await listLedger(test)).toMatchObject([{ status: "rejected", reason: "mailing.invalid_input" }]);
  });

  it("releases the claim when the provider is unavailable, and sends on the next run with the same key", async () => {
    respond.mockReturnValueOnce({ status: "unavailable", httpStatus: 503 });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).toEqual({ status: "retry-later" });
    expect(await listLedger(test)).toMatchObject([{ status: "pending", attempts: 1, finished_at: null, reason: null }]);

    test.clock.advance(1_000);
    const outcome = await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    expect(outcome).toEqual({ status: "sent", id: provider.sent[0]?.id });
    expect(respond.mock.calls.map(([message]) => message.idempotencyKey)).toEqual([`${SCOPE}:${ADA_KEY}`, `${SCOPE}:${ADA_KEY}`]);
    expect(await listLedger(test)).toMatchObject([{ status: "sent", attempts: 2, claimed_at: new Date(NOW.getTime() + 1_000) }]);
  });

  it("gives up after the last attempt and closes the delivery as unavailable", async () => {
    respond.mockReturnValue({ status: "unavailable" });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL }, { maxAttempts: 2 })).toEqual({ status: "retry-later" });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL }, { maxAttempts: 2 })).toEqual({ status: "rejected", reason: "mailing.unavailable" });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL }, { maxAttempts: 2 })).toEqual({ status: "done", outcome: "rejected" });
    expect(respond).toHaveBeenCalledTimes(2);
  });

  it("leaves a fresh claim of another sender alone", async () => {
    await insertClaim(test, { claimedAt: new Date(NOW.getTime() - 60_000), attempts: 1 });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).toEqual({ status: "in-flight" });
    expect(respond).not.toHaveBeenCalled();
  });

  it("takes over a stale claim (a sender that crashed) and re-sends with the same idempotency key", async () => {
    await insertClaim(test, { claimedAt: new Date(NOW.getTime() - 15 * 60_000 - 1), attempts: 1 });
    const outcome = await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    expect(outcome.status).toBe("sent");
    expect(provider.sent[0]?.idempotencyKey).toBe(`${SCOPE}:${ADA_KEY}`);
    expect(await listLedger(test)).toMatchObject([{ status: "sent", attempts: 2, claimed_at: NOW }]);
  });

  it("honours a shorter stale-claim timeout", async () => {
    await insertClaim(test, { claimedAt: new Date(NOW.getTime() - 61_000), attempts: 1 });
    expect((await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL }, { staleClaimMs: 60_000 })).status).toBe("sent");
  });

  it("does not let a sender whose claim went stale overwrite the outcome of the one that took over", async () => {
    let takeOver: Promise<unknown> = Promise.resolve();
    respond.mockImplementationOnce(() => {
      // While the first send is in flight, its claim goes stale and a second sender takes over.
      test.clock.advance(16 * 60_000);
      takeOver = deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
      return { status: "rejected" };
    });
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).toEqual({ status: "rejected", reason: "mailing.rejected" });
    await takeOver;
    expect(await listLedger(test)).toMatchObject([{ status: "sent", attempts: 2, reason: null }]);
  });

  it("claims one row for two senders racing on the same delivery", async () => {
    const outcomes = await Promise.all([deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL }), deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })]);
    // The loser reads the row while it is claimed or after it closed, depending on timing.
    expect(outcomes.filter((outcome) => outcome.status === "sent")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "in-flight" || outcome.status === "done")).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });

  it.each([
    ["an uppercase scope", { scope: "Billing:1", mail: MAIL }, /scope "Billing:1"/],
    ["an empty scope", { scope: "", mail: MAIL }, /scope ""/],
    ["a scope over 128 characters", { scope: "a".repeat(129), mail: MAIL }, /at most 128/],
    ["a kind that is not kebab-case", { scope: SCOPE, mail: { ...MAIL, kind: "News Letter" } }, /kind "News Letter"/],
    ["a campaign id that does not match the scope", { scope: SCOPE, campaignId: "launch", mail: LIST_MAIL }, /scope "campaign:launch"/],
  ])("throws for %s before touching the database", async (_case, delivery, message) => {
    await expect(deliverOnce(test.ctx, delivery)).rejects.toThrow(message);
    expect(await listLedger(test)).toEqual([]);
  });

  it("lets a database failure propagate before anything is sent", async () => {
    await test.database.client.query("DROP TABLE mailing.deliveries");
    await expect(deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL })).rejects.toThrow();
    expect(respond).not.toHaveBeenCalled();
  });
});

describe("the deliveries table", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insert = (row: Record<string, unknown>) => {
    const values = { scope: SCOPE, recipient_key: ADA_KEY, kind: "transactional", campaign_id: null, status: "claimed", attempts: 1, claimed_at: NOW, finished_at: null, provider_message_id: null, reason: null, created_at: NOW, ...row };
    const columns = Object.keys(values);
    return test.database.client.query(
      `INSERT INTO mailing.deliveries (${columns.join(", ")}) VALUES (${columns.map((_, index) => `$${String(index + 1)}`).join(", ")})`,
      Object.values(values),
    );
  };

  it("accepts a well-formed claim", async () => {
    await expect(insert({})).resolves.toBeDefined();
  });

  it.each([
    ["a second row for the same scope and recipient", () => insert({}), {}],
    ["an address instead of a recipient key", () => Promise.resolve(), { recipient_key: "ada@example.org" }],
    ["an unknown status", () => Promise.resolve(), { status: "queued" }],
    ["a sent row without a provider id", () => Promise.resolve(), { status: "sent", finished_at: NOW }],
    ["a rejected row without a reason", () => Promise.resolve(), { status: "rejected", finished_at: NOW }],
    ["a closed row without a finish time", () => Promise.resolve(), { status: "sent", provider_message_id: "id-1" }],
    ["an unknown reason", () => Promise.resolve(), { status: "rejected", finished_at: NOW, reason: "mailing.bounced" }],
    ["zero attempts", () => Promise.resolve(), { attempts: 0 }],
    ["a campaign row outside its campaign scope", () => test.database.client.query("INSERT INTO mailing.campaigns VALUES ('launch', 'newsletter', 'Hi', $1, $2)", ["a".repeat(64), NOW]), { campaign_id: "launch" }],
    ["a campaign that does not exist", () => Promise.resolve(), { scope: "campaign:ghost", campaign_id: "ghost" }],
  ])("refuses %s", async (_case, setUp, row) => {
    await setUp();
    await expect(insert(row)).rejects.toThrow();
  });

  it.each([
    ["an id that is not kebab-case", ["Launch", "newsletter"]],
    ["a transactional campaign", ["launch", "transactional"]],
  ])("refuses a campaign with %s", async (_case, [id, kind]) => {
    await expect(test.database.client.query("INSERT INTO mailing.campaigns VALUES ($1, $2, 'Hi', $3, $4)", [id, kind, "a".repeat(64), NOW])).rejects.toThrow();
  });
});

async function insertClaim(test: TestMailing, claim: { claimedAt: Date; attempts: number }): Promise<void> {
  await test.database.client.query(
    "INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at) VALUES ($1, $2, 'transactional', 'claimed', $3, $4, $4)",
    [SCOPE, ADA_KEY, claim.attempts, claim.claimedAt],
  );
}
