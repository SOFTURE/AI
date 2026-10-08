// Campaigns: N recipients give N ledger outcomes, a re-run sends nothing new, content is pinned.
import { getCampaignContentHash, getRecipientKey, listConfiguredCampaignRecipients, planCampaign, registerCampaign, sendCampaign, type CampaignContent, type DeliveryOutcome } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, NOW, SECRET, type TestMailing } from "./support.js";

const CAMPAIGN: CampaignContent = {
  id: "2026-10-launch",
  kind: "newsletter",
  subject: "Something new",
  text: "Hello, we shipped something.",
  html: "<p>Hello, we shipped something.</p>",
};
const RECIPIENTS = ["ada@example.org", "bob@example.org", "cy@example.org"];
const NO_REJECTIONS = {
  "mailing.invalid_input": 0,
  "mailing.rejected": 0,
  "mailing.unavailable": 0,
  "mailing.suppressed": 0,
  "mailing.provider_refused": 0,
  "mailing.quota_exceeded": 0,
};
const NOTHING_ELSE = { filtered: 0, uncertain: 0, halted: null };

async function countOutcomes(test: TestMailing): Promise<Record<string, number>> {
  const result = await test.database.client.query<{ status: string; count: number }>(
    "SELECT status, count(*)::int AS count FROM mailing.deliveries WHERE campaign_id = $1 GROUP BY status ORDER BY status",
    [CAMPAIGN.id],
  );
  return Object.fromEntries(result.rows.map((row) => [row.status, row.count]));
}

describe("sendCampaign", () => {
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

  it("sends the campaign to every recipient as list mail and records one outcome each", async () => {
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });

    expect(result).toEqual({ ok: true, value: { recipients: 3, sent: 3, rejected: NO_REJECTIONS, done: 0, inFlight: 0, retryLater: 0, ...NOTHING_ELSE } });
    expect(provider.sent.map((mail) => mail.to)).toEqual(RECIPIENTS);
    expect(provider.sent.every((mail) => mail.subject === CAMPAIGN.subject && mail.text.startsWith(CAMPAIGN.text) && mail.html?.startsWith(CAMPAIGN.html ?? ""))).toBe(true);
    expect(provider.sent.every((mail) => mail.headers["List-Unsubscribe"] !== undefined)).toBe(true);
    expect(provider.sent.map((mail) => mail.idempotencyKey)).toEqual(RECIPIENTS.map((to) => `campaign:${CAMPAIGN.id}:${getRecipientKey(to)}`));
    expect(await countOutcomes(test)).toEqual({ sent: 3 });
  });

  it("sends nothing new when run again", async () => {
    await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    const again = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: [...RECIPIENTS, "dee@example.org"] });

    expect(again).toEqual({ ok: true, value: { recipients: 4, sent: 1, rejected: NO_REJECTIONS, done: 3, inFlight: 0, retryLater: 0, ...NOTHING_ELSE } });
    expect(provider.sent).toHaveLength(4);
    expect(await countOutcomes(test)).toEqual({ sent: 4 });
  });

  it("rejects recipients who unsubscribed, without a send, and counts them", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'one-click', $2)", [getRecipientKey("bob@example.org"), NOW]);
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });

    expect(result.ok && result.value).toMatchObject({ sent: 2, rejected: { ...NO_REJECTIONS, "mailing.suppressed": 1 } });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org", "cy@example.org"]);
    expect(await countOutcomes(test)).toEqual({ rejected: 1, sent: 2 });
  });

  it("mails a recipient listed twice (in any case) once", async () => {
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: ["ada@example.org", " ADA@example.org"] });
    expect(result.ok && result.value).toMatchObject({ recipients: 1, sent: 1 });
    expect(provider.sent).toHaveLength(1);
  });

  it("reads the recipients from an async iterable", async () => {
    async function* stream() {
      for (const recipient of RECIPIENTS) yield await Promise.resolve(recipient);
    }
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: stream() });
    expect(result.ok && result.value.sent).toBe(3);
  });

  it("counts recipients for a later run when the provider is unavailable, and sends them then", async () => {
    respond.mockImplementation((message) => (message.to === "bob@example.org" ? { status: "unavailable" } : undefined));
    const first = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    expect(first.ok && first.value).toMatchObject({ sent: 2, retryLater: 1 });

    respond.mockReturnValue(undefined);
    const second = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    expect(second.ok && second.value).toMatchObject({ sent: 1, done: 2, retryLater: 0 });
    expect(await countOutcomes(test)).toEqual({ sent: 3 });
  });

  it.each([
    ["a refused key", { status: "refused", httpStatus: 401 } as const, "mailing.provider_refused", 401],
    ["a spent quota", { status: "quota_exceeded", httpStatus: 429 } as const, "mailing.quota_exceeded", 429],
  ])("stops at %s, leaves that recipient and the rest untouched, and sends them on the next run", async (_case, refusal, reason, status) => {
    respond.mockImplementation((message) => (message.to === "bob@example.org" ? refusal : undefined));
    const first = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    expect(first).toEqual({
      ok: true,
      value: { recipients: 2, sent: 1, rejected: NO_REJECTIONS, done: 0, inFlight: 0, retryLater: 1, filtered: 0, uncertain: 0, halted: { reason, httpStatus: status } },
    });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org"]);
    expect(await countOutcomes(test)).toEqual({ pending: 1, sent: 1 });

    respond.mockReturnValue(undefined);
    const second = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    expect(second.ok && second.value).toMatchObject({ sent: 2, done: 1, halted: null });
    expect(await countOutcomes(test)).toEqual({ sent: 3 });
  });

  it("skips recipients the module's filter refuses, stores nothing for them, and sends once they qualify", async () => {
    const consented = new Set(["ada@example.org", "cy@example.org"]);
    const filterCampaignRecipient = vi.fn(({ address }: { address: string }) => Promise.resolve(consented.has(address)));
    const filtering = await createTestMailing(createConfig(provider, { filterCampaignRecipient }));
    try {
      const first = await sendCampaign(filtering.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
      expect(first.ok && first.value).toMatchObject({ recipients: 3, sent: 2, filtered: 1 });
      expect(filterCampaignRecipient).toHaveBeenCalledWith(
        { address: "bob@example.org", recipientKey: getRecipientKey("bob@example.org"), campaign: { id: CAMPAIGN.id, kind: CAMPAIGN.kind } },
        filtering.ctx,
      );
      expect(await countOutcomes(filtering)).toEqual({ sent: 2 });

      consented.add("bob@example.org");
      const second = await sendCampaign(filtering.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
      expect(second.ok && second.value).toMatchObject({ sent: 1, done: 2, filtered: 0 });
    } finally {
      await filtering.database.close();
    }
  });

  it("stops when the filter throws, like a database failure", async () => {
    const filtering = await createTestMailing(createConfig(provider, { filterCampaignRecipient: () => Promise.reject(new Error("consents unreadable")) }));
    try {
      await expect(sendCampaign(filtering.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS })).rejects.toThrow("consents unreadable");
      expect(provider.sent).toEqual([]);
    } finally {
      await filtering.database.close();
    }
  });

  it("counts an uncertain claim and does not send it", async () => {
    await registerCampaign(test.ctx, CAMPAIGN);
    await insertCampaignClaim(test, "bob@example.org", new Date(NOW.getTime() - 24 * 3_600_000));
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS });
    expect(result.ok && result.value).toMatchObject({ sent: 2, uncertain: 1 });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org", "cy@example.org"]);
  });

  it("pauses after every mail that reached the provider, and reports each outcome", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'one-click', $2)", [getRecipientKey("cy@example.org"), NOW]);
    const sleep = vi.fn(() => Promise.resolve());
    const onDelivery = vi.fn<(outcome: DeliveryOutcome) => void>();
    await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS }, { pauseMs: 500, sleep, onDelivery });

    expect(sleep.mock.calls).toEqual([[500], [500]]);
    expect(onDelivery.mock.calls.map(([outcome]) => outcome.status)).toEqual(["sent", "sent", "rejected"]);
  });

  it("refuses other content under an id that was already sent, and sends nothing", async () => {
    await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: ["ada@example.org"] });
    const changed = await sendCampaign(test.ctx, { campaign: { ...CAMPAIGN, subject: "Something newer" }, recipients: RECIPIENTS });

    expect(changed).toEqual({ ok: false, error: "mailing.campaign_changed" });
    expect(provider.sent).toHaveLength(1);
  });

  it("throws for content that cannot be a campaign", async () => {
    await expect(sendCampaign(test.ctx, { campaign: { ...CAMPAIGN, kind: "transactional" }, recipients: RECIPIENTS })).rejects.toThrow(/never transactional/);
    expect(provider.sent).toEqual([]);
  });
});

describe("registerCampaign", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("stores the campaign with its content hash once, and confirms the same content again", async () => {
    expect(await registerCampaign(test.ctx, CAMPAIGN)).toEqual({ ok: true, value: undefined });
    test.clock.advance(60_000);
    expect(await registerCampaign(test.ctx, CAMPAIGN)).toEqual({ ok: true, value: undefined });
    const rows = await test.database.client.query("SELECT id, kind, subject, content_hash, created_at FROM mailing.campaigns");
    expect(rows.rows).toEqual([{ id: CAMPAIGN.id, kind: "newsletter", subject: "Something new", content_hash: getCampaignContentHash(CAMPAIGN), created_at: NOW }]);
  });

  it.each([
    ["the kind", { kind: "digest" }],
    ["the subject", { subject: "Other" }],
    ["the text", { text: "Other text." }],
    ["the HTML", { html: null }],
  ])("refuses a change of %s", async (_case, change) => {
    await registerCampaign(test.ctx, CAMPAIGN);
    expect(await registerCampaign(test.ctx, { ...CAMPAIGN, ...change })).toEqual({ ok: false, error: "mailing.campaign_changed" });
  });
});

describe("planCampaign", () => {
  let provider: FakeMailProvider;
  let test: TestMailing;

  beforeEach(async () => {
    provider = fakeMailProvider();
    test = await createTestMailing(createConfig(provider));
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await test.database.close();
  });

  it("counts what a run would do and writes nothing", async () => {
    await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients: ["ada@example.org"] });
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'page', $2)", [getRecipientKey("bob@example.org"), NOW]);

    const plan = await planCampaign(test.ctx, { campaign: CAMPAIGN, recipients: [...RECIPIENTS, "ADA@example.org"] });

    expect(plan).toEqual({ recipients: 3, done: 1, suppressed: 1, filtered: 0, uncertain: 0, toSend: 1, contentChanged: false });
    expect(provider.sent).toHaveLength(1);
    expect(await countOutcomes(test)).toEqual({ sent: 1 });
  });

  it("says when the content differs from what was sent under the id", async () => {
    await registerCampaign(test.ctx, CAMPAIGN);
    expect((await planCampaign(test.ctx, { campaign: { ...CAMPAIGN, text: "Changed." }, recipients: [] })).contentChanged).toBe(true);
  });

  it("plans a new campaign without registering it", async () => {
    expect(await planCampaign(test.ctx, { campaign: CAMPAIGN, recipients: RECIPIENTS })).toEqual({
      recipients: 3,
      done: 0,
      suppressed: 0,
      filtered: 0,
      uncertain: 0,
      toSend: 3,
      contentChanged: false,
    });
    expect((await test.database.client.query("SELECT 1 FROM mailing.campaigns")).rows).toEqual([]);
  });

  it("counts filtered and uncertain recipients, and sends uncertain ones only when told to retake them", async () => {
    const filtering = await createTestMailing(createConfig(provider, { filterCampaignRecipient: ({ address }) => Promise.resolve(address !== "cy@example.org") }));
    try {
      await registerCampaign(filtering.ctx, CAMPAIGN);
      await insertCampaignClaim(filtering, "bob@example.org", new Date(NOW.getTime() - 24 * 3_600_000));
      const input = { campaign: CAMPAIGN, recipients: RECIPIENTS };
      expect(await planCampaign(filtering.ctx, input)).toMatchObject({ filtered: 1, uncertain: 1, toSend: 1 });
      expect(await planCampaign(filtering.ctx, input, { retakeUncertain: true })).toMatchObject({ filtered: 1, uncertain: 1, toSend: 2 });
    } finally {
      await filtering.database.close();
    }
  });
});

async function insertCampaignClaim(test: TestMailing, address: string, claimedAt: Date): Promise<void> {
  await test.database.client.query(
    "INSERT INTO mailing.deliveries (scope, recipient_key, kind, campaign_id, status, attempts, claimed_at, created_at) VALUES ($1, $2, $3, $4, 'claimed', 1, $5, $5)",
    [`campaign:${CAMPAIGN.id}`, getRecipientKey(address), CAMPAIGN.kind, CAMPAIGN.id, claimedAt],
  );
}

describe("listConfiguredCampaignRecipients", () => {
  it("asks the app's source for the campaign's recipients, and answers null without one", async () => {
    const listCampaignRecipients = vi.fn(() => Promise.resolve(["ada@example.org", "bob@example.org"]));
    const withSource = await createTestMailing(createConfig(fakeMailProvider(), { listCampaignRecipients }));
    const without = await createTestMailing();
    try {
      expect(await listConfiguredCampaignRecipients(withSource.ctx, CAMPAIGN)).toEqual(["ada@example.org", "bob@example.org"]);
      expect(listCampaignRecipients).toHaveBeenCalledWith({ id: CAMPAIGN.id, kind: CAMPAIGN.kind }, withSource.ctx);
      expect(await listConfiguredCampaignRecipients(without.ctx, CAMPAIGN)).toBeNull();
    } finally {
      await withSource.database.close();
      await without.database.close();
    }
  });
});
