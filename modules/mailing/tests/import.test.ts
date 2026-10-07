// Importing an app's own delivery history: imported recipients are skipped by every later send, a re-run imports
// nothing twice, and an invalid row stops the import before anything is written.
import { deliverOnce, getRecipientKey, importDeliveries, planCampaign, sendCampaign, type CampaignContent, type ImportedDelivery } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, MAIL, NOW, SECRET, type TestMailing } from "./support.js";

const CAMPAIGN: CampaignContent = { id: "2026-09-launch", kind: "newsletter", subject: "Something new", text: "Hello.", html: null };
const CAMPAIGN_SCOPE = `campaign:${CAMPAIGN.id}`;
const NOTICE_SCOPE = "account.trial-ending:user_7";
const FINISHED_AT = "2026-09-20T10:15:00.000Z";

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
  created_at: Date;
  imported_at: Date | null;
}

async function listLedger(test: TestMailing): Promise<LedgerRow[]> {
  const result = await test.database.client.query<LedgerRow>(
    "SELECT scope, recipient_key, kind, campaign_id, status, attempts, claimed_at, finished_at, provider_message_id, reason, created_at, imported_at FROM mailing.deliveries ORDER BY scope, recipient_key",
  );
  return result.rows;
}

describe("importDeliveries", () => {
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

  it("stores a sent row without a message id as an imported, closed delivery keyed by the address", async () => {
    const result = await importDeliveries(test.ctx, [{ scope: NOTICE_SCOPE, address: " Ada@Example.org ", status: "sent", finishedAt: FINISHED_AT }]);

    expect(result).toEqual({ ok: true, value: { rows: 1, imported: 1, alreadyPresent: 0, duplicates: 0 } });
    expect(await listLedger(test)).toEqual([
      {
        scope: NOTICE_SCOPE,
        recipient_key: getRecipientKey("ada@example.org"),
        kind: "transactional",
        campaign_id: null,
        status: "sent",
        attempts: 1,
        claimed_at: new Date(FINISHED_AT),
        finished_at: new Date(FINISHED_AT),
        provider_message_id: null,
        reason: null,
        created_at: NOW,
        imported_at: NOW,
      },
    ]);
  });

  it("keeps a given message id and kind, and defaults a rejected row's reason to mailing.rejected", async () => {
    const rows: ImportedDelivery[] = [
      { scope: NOTICE_SCOPE, address: "ada@example.org", status: "sent", finishedAt: new Date(FINISHED_AT), providerMessageId: "msg_1", kind: "account-notices" },
      { scope: NOTICE_SCOPE, address: "bob@example.org", status: "rejected", finishedAt: FINISHED_AT },
      { scope: NOTICE_SCOPE, address: "cy@example.org", status: "rejected", finishedAt: FINISHED_AT, reason: "mailing.suppressed" },
    ];

    expect(await importDeliveries(test.ctx, rows)).toEqual({ ok: true, value: { rows: 3, imported: 3, alreadyPresent: 0, duplicates: 0 } });
    const ledger = await listLedger(test);
    const byKey = new Map(ledger.map((row) => [row.recipient_key, row]));
    expect(byKey.get(getRecipientKey("ada@example.org"))).toMatchObject({ status: "sent", provider_message_id: "msg_1", kind: "account-notices" });
    expect(byKey.get(getRecipientKey("bob@example.org"))).toMatchObject({ status: "rejected", reason: "mailing.rejected", provider_message_id: null });
    expect(byKey.get(getRecipientKey("cy@example.org"))).toMatchObject({ status: "rejected", reason: "mailing.suppressed" });
  });

  it("makes deliverOnce answer done for an imported delivery, without a send", async () => {
    await importDeliveries(test.ctx, [{ scope: NOTICE_SCOPE, address: MAIL.to, status: "sent", finishedAt: FINISHED_AT }]);

    expect(await deliverOnce(test.ctx, { scope: NOTICE_SCOPE, mail: MAIL })).toEqual({ status: "done", outcome: "sent" });
    expect(provider.sent).toEqual([]);
  });

  it("makes a campaign skip imported recipients in its plan and its run, and send to the rest", async () => {
    await importDeliveries(test.ctx, [
      { scope: CAMPAIGN_SCOPE, address: "ada@example.org", status: "sent", finishedAt: FINISHED_AT, kind: "newsletter" },
      { scope: CAMPAIGN_SCOPE, address: "bob@example.org", status: "rejected", finishedAt: FINISHED_AT, kind: "newsletter" },
    ]);
    const recipients = ["ada@example.org", "BOB@example.org", "cy@example.org"];

    expect(await planCampaign(test.ctx, { campaign: CAMPAIGN, recipients })).toMatchObject({ recipients: 3, done: 2, toSend: 1 });
    const result = await sendCampaign(test.ctx, { campaign: CAMPAIGN, recipients });
    expect(result).toMatchObject({ ok: true, value: { recipients: 3, sent: 1, done: 2 } });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["cy@example.org"]);
  });

  it("imports nothing twice and leaves a row already in the ledger as it was, even a live claim", async () => {
    const row: ImportedDelivery = { scope: NOTICE_SCOPE, address: MAIL.to, status: "sent", finishedAt: FINISHED_AT };
    await importDeliveries(test.ctx, [row]);
    const firstLedger = await listLedger(test);
    test.clock.advance(60_000);

    expect(await importDeliveries(test.ctx, [row])).toEqual({ ok: true, value: { rows: 1, imported: 0, alreadyPresent: 1, duplicates: 0 } });
    expect(await listLedger(test)).toEqual(firstLedger);

    await test.database.client.query("INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at) VALUES ($1, $2, 'transactional', 'claimed', 1, $3, $3)", [
      "account.welcome:user_7",
      getRecipientKey(MAIL.to),
      NOW,
    ]);
    expect(await importDeliveries(test.ctx, [{ ...row, scope: "account.welcome:user_7", status: "rejected" }])).toMatchObject({ ok: true, value: { imported: 0, alreadyPresent: 1 } });
    expect((await listLedger(test)).find((stored) => stored.scope === "account.welcome:user_7")).toMatchObject({ status: "claimed", imported_at: null });
  });

  it("counts a second row for the same scope and recipient as a duplicate and keeps the first", async () => {
    const result = await importDeliveries(test.ctx, [
      { scope: NOTICE_SCOPE, address: "ada@example.org", status: "sent", finishedAt: FINISHED_AT },
      { scope: NOTICE_SCOPE, address: "ADA@example.org", status: "rejected", finishedAt: FINISHED_AT },
      { scope: CAMPAIGN_SCOPE, address: "ada@example.org", status: "sent", finishedAt: FINISHED_AT },
    ]);

    expect(result).toEqual({ ok: true, value: { rows: 3, imported: 2, alreadyPresent: 0, duplicates: 1 } });
    expect((await listLedger(test)).map((row) => `${row.scope} ${row.status}`)).toEqual([`${NOTICE_SCOPE} sent`, `${CAMPAIGN_SCOPE} sent`]);
  });

  it("imports more rows than one statement takes", async () => {
    const rows: ImportedDelivery[] = Array.from({ length: 1_201 }, (_, index) => ({ scope: CAMPAIGN_SCOPE, address: `person${String(index)}@example.org`, status: "sent", finishedAt: FINISHED_AT }));

    expect(await importDeliveries(test.ctx, rows)).toEqual({ ok: true, value: { rows: 1_201, imported: 1_201, alreadyPresent: 0, duplicates: 0 } });
    expect(await listLedger(test)).toHaveLength(1_201);
  });

  it("reports every problem by row index, never the address, and writes nothing", async () => {
    const result = await importDeliveries(test.ctx, [
      { scope: NOTICE_SCOPE, address: "ada@example.org", status: "sent", finishedAt: FINISHED_AT },
      { scope: "Campaign:X", address: "not an address", status: "sent", finishedAt: "yesterday" },
      { scope: NOTICE_SCOPE, address: "bob@example.org", status: "sent", finishedAt: "2026-10-04T00:00:00Z", reason: "mailing.rejected" },
      { scope: NOTICE_SCOPE, address: "cy@example.org", status: "rejected", finishedAt: FINISHED_AT, providerMessageId: "msg_9", kind: "Account Notices" },
      // Values an untyped source (JSON) can carry.
      { scope: NOTICE_SCOPE, address: "dee@example.org", status: "bounced", finishedAt: FINISHED_AT } as unknown as ImportedDelivery,
      { scope: NOTICE_SCOPE, address: "eve@example.org", status: "rejected", finishedAt: FINISHED_AT, reason: "mailing.quota_exceeded" } as unknown as ImportedDelivery,
      { scope: NOTICE_SCOPE, address: "fay@example.org", status: "sent", finishedAt: FINISHED_AT, providerMessageId: " " },
    ]);

    expect(result).toEqual({
      ok: false,
      problems: [
        { index: 1, problem: "scope must be lowercase letters, digits and ._:- (at most 128 characters)" },
        { index: 1, problem: "address must be one email address" },
        { index: 1, problem: "finishedAt must be a date" },
        { index: 2, problem: "finishedAt must not be in the future" },
        { index: 2, problem: "reason belongs only to a rejected row" },
        { index: 3, problem: "providerMessageId belongs only to a sent row" },
        { index: 3, problem: "kind must be kebab-case (at most 64 characters)" },
        { index: 4, problem: 'status must be "sent" or "rejected"' },
        { index: 5, problem: "reason must be one of mailing.invalid_input, mailing.rejected, mailing.unavailable, mailing.suppressed" },
        { index: 6, problem: "providerMessageId must be 1 to 256 characters" },
      ],
    });
    expect(await listLedger(test)).toEqual([]);
  });

  it("leaves the database rule in place: a sent row the module did not import needs a message id", async () => {
    await expect(
      test.database.client.query("INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, finished_at, created_at) VALUES ($1, $2, 'transactional', 'sent', 1, $3, $3, $3)", [
        NOTICE_SCOPE,
        getRecipientKey(MAIL.to),
        NOW,
      ]),
    ).rejects.toThrow(/deliveries_sent_message_id_check/);
    await expect(
      test.database.client.query(
        "INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at, provider_message_id) VALUES ($1, $2, 'transactional', 'claimed', 1, $3, $3, 'msg_1')",
        [NOTICE_SCOPE, getRecipientKey(MAIL.to), NOW],
      ),
    ).rejects.toThrow(/deliveries_message_id_check/);
    await expect(
      test.database.client.query("INSERT INTO mailing.deliveries (scope, recipient_key, kind, status, attempts, claimed_at, created_at, imported_at) VALUES ($1, $2, 'transactional', 'claimed', 1, $3, $3, $3)", [
        NOTICE_SCOPE,
        getRecipientKey(MAIL.to),
        NOW,
      ]),
    ).rejects.toThrow(/deliveries_imported_at_check/);
  });
});
