// The SQL surface an app's own queries use instead of the tables: the recipient key, the suppression and delivery
// predicates and two views whose columns stay put when the tables change.
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

  async function selectOne<T>(sql: string, params: unknown[]): Promise<T> {
    const result = await test.database.client.query<{ value: T }>(sql, params);
    return result.rows[0]?.value as T;
  }

  it.each([
    "ada@example.org",
    "Ada.Lovelace+News@Example.ORG",
    "  ada@example.org\t",
    "\n ADA@EXAMPLE.ORG \r\n",
    " ada@example.org　",
    "﻿ada@example.org ",
    "zoë@example.org",
  ])("mailing.recipient_key(%j) equals getRecipientKey", async (address) => {
    expect(await selectOne("SELECT mailing.recipient_key($1) AS value", [address])).toBe(getRecipientKey(address));
  });

  it("mailing.recipient_key(NULL) is NULL", async () => {
    expect(await selectOne("SELECT mailing.recipient_key(NULL) AS value", [])).toBeNull();
  });

  it("mailing.is_suppressed tells whether an address unsubscribed, whatever its case and spacing", async () => {
    await suppressRecipient(test.ctx, MAIL.to);

    expect(await selectOne("SELECT mailing.is_suppressed($1) AS value", [" ADA@example.org "])).toBe(true);
    expect(await selectOne("SELECT mailing.is_suppressed($1) AS value", ["bob@example.org"])).toBe(false);
  });

  it("mailing.was_delivered is true only for a sent delivery of that scope and address", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: MAIL });

    expect(await selectOne("SELECT mailing.was_delivered($1, $2) AS value", [SCOPE, "Ada@Example.org"])).toBe(true);
    expect(await selectOne("SELECT mailing.was_delivered($1, $2) AS value", ["billing.renewal:sub_42", MAIL.to])).toBe(false);
    expect(await selectOne("SELECT mailing.was_delivered($1, $2) AS value", [SCOPE, "bob@example.org"])).toBe(false);
  });

  it("mailing.was_delivered is false for a rejected delivery", async () => {
    await deliverOnce(test.ctx, { scope: SCOPE, mail: { ...MAIL, subject: "" } });

    expect(await selectOne("SELECT mailing.was_delivered($1, $2) AS value", [SCOPE, MAIL.to])).toBe(false);
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

  it("joins an app's table on the recipient key in SQL", async () => {
    await test.database.client.query("CREATE TABLE public.subscribers (email text NOT NULL)");
    await test.database.client.query("INSERT INTO public.subscribers VALUES ('ada@example.org'), ('Bob@example.org'), ('cy@example.org')");
    await suppressRecipient(test.ctx, "bob@example.org");

    const result = await test.database.client.query<{ email: string }>(
      "SELECT email FROM public.subscribers s WHERE NOT EXISTS (SELECT 1 FROM mailing.suppressed_recipients r WHERE r.recipient_key = mailing.recipient_key(s.email)) ORDER BY email",
    );

    expect(result.rows.map((row) => row.email)).toEqual(["ada@example.org", "cy@example.org"]);
  });
});
