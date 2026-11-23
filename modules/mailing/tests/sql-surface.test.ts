// The SQL surface an app's own queries use instead of the tables: two views whose columns stay put when the tables
// change. The recipient key needs a secret only the server holds, so SQL takes keys from getRecipientKey.
import { deliverOnce, getRecipientKey, suppressRecipient } from "@softure-ai/mailing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestMailing, MAIL, NOW, SECRET, type TestMailing } from "./support.js";

const SCOPE = "billing.trial-ending:sub_42";

describe("the mailing SQL surface", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await test.database.close();
  });

  it("has no function that keys an address in SQL any more (migration 0006)", async () => {
    const result = await test.database.client.query<{ name: string }>(
      "SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'mailing' ORDER BY 1",
    );

    expect(result.rows.map((row) => row.name)).not.toContain("recipient_key");
    expect(result.rows.map((row) => row.name)).not.toContain("is_suppressed");
    expect(result.rows.map((row) => row.name)).not.toContain("was_delivered");
  });

  it("the views expose the ledger and the suppression list under fixed columns", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });
    await suppressRecipient(test.ctx, "bob@example.org");

    const outcomes = await test.database.client.query("SELECT * FROM mailing.delivery_outcomes");
    const suppressed = await test.database.client.query("SELECT * FROM mailing.suppressed_recipients");

    expect(outcomes.rows).toEqual([
      {
        scope: SCOPE,
        recipient_key: getRecipientKey(MAIL.to),
        kind: "transactional",
        campaign_id: null,
        status: "sent",
        attempts: 1,
        claimed_at: NOW,
        finished_at: NOW,
        imported_at: null,
      },
    ]);
    expect(suppressed.rows).toEqual([{ recipient_key: getRecipientKey("bob@example.org"), source: "operator", created_at: NOW }]);
  });

  it("filters an app's addresses on keys from getRecipientKey", async () => {
    await suppressRecipient(test.ctx, "bob@example.org");
    const addresses = ["ada@example.org", "Bob@example.org", "cy@example.org"];

    const result = await test.database.client.query<{ recipient_key: string }>(
      "SELECT recipient_key FROM mailing.suppressed_recipients WHERE recipient_key = ANY($1::text[])",
      [addresses.map((address) => getRecipientKey(address))],
    );
    const suppressed = new Set(result.rows.map((row) => row.recipient_key));

    expect(addresses.filter((address) => !suppressed.has(getRecipientKey(address)))).toEqual(["ada@example.org", "cy@example.org"]);
  });
});
