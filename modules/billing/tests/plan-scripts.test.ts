// The grant-plan and revoke-grant ops scripts on PGlite: a dry run writes nothing and reports the
// change, `--commit` records the grant like the admin page (in the history, revocable from either
// side), refusals write nothing, and the command never prints the email.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { createGrantPlanScript, createRevokeGrantScript } from "@softure-ai/billing/scripts";
import { getAccountHistory, getEntitlement, grantPlanManually, revokeManualGrant } from "@softure-ai/billing/server";
import { err } from "@softure-ai/core";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** The end of a 14-day trial begun at NOW, and one month on top. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const LATER = new Date("2026-10-05T08:00:00Z");

interface GrantRow {
  id: string;
  plan_id: string;
  granted_by: string | null;
  granted_at: Date;
  status: string;
  revoked_at: Date | null;
  revoked_by: string | null;
}

async function readGrants(test: TestBilling): Promise<GrantRow[]> {
  const result = await test.database.client.query<GrantRow>(
    "SELECT id, plan_id, granted_by, granted_at, status, revoked_at, revoked_by FROM billing.manual_grants ORDER BY granted_at, id",
  );
  return result.rows;
}

describe("the plan scripts", () => {
  let test: TestBilling;
  let adaId: string;

  function grant() {
    return createGrantPlanScript(test.config, { clock: test.clock });
  }

  function revoke() {
    return createRevokeGrantScript(test.config, { clock: test.clock });
  }

  async function grantByScript(email: string, plan: string): Promise<string> {
    const outcome = await executeOpsScript(test.database.db, grant(), { email, plan }, { commit: true });
    if (!outcome.ok) throw new Error(`setup: grant-plan refused: ${outcome.reason}`);
    const [row] = await readGrants(test);
    if (row === undefined) throw new Error("setup: grant-plan recorded no grant");
    return row.id;
  }

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  describe("grant-plan", () => {
    it("writes nothing on a dry run and reports the change by user id, with the new grant's id", async () => {
      const outcome = await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", plan: "monthly" }, { commit: false });
      expect(outcome).toMatchObject({
        ok: true,
        value: {
          committed: false,
          report: {
            before: { userId: adaId, access: { status: "trial", endsAt: TRIAL_END }, grants: [] },
            after: {
              userId: adaId,
              access: { status: "paid", endsAt: MONTH_AFTER_TRIAL },
              grants: [{ id: expect.any(String) as unknown, planId: "monthly", grantedAt: NOW, grant: { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL } }],
            },
          },
        },
      });
      expect(await readGrants(test)).toEqual([]);
      expect(await readRow(test, adaId)).toBeUndefined();
    });

    it("records the grant with --commit like the admin page, finding the account whatever the email's case", async () => {
      const outcome = await executeOpsScript(test.database.db, grant(), { email: " ADA@Example.com", plan: "monthly" }, { commit: true });
      expect(outcome).toMatchObject({ ok: true, value: { committed: true } });
      const [row] = await readGrants(test);
      expect(row).toMatchObject({ plan_id: "monthly", granted_by: null, granted_at: NOW, status: "active" });
      expect(await getAccountHistory(test.ctx, adaId)).toEqual([
        { source: "manual", id: row?.id, planId: "monthly", at: NOW, grant: { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL }, status: "active", revokedAt: null, isFromRequest: false, price: { amount: 2900, currency: "PLN" } },
      ]);
      expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
    });

    it("leaves a grant the admin page can revoke", async () => {
      const grantId = await grantByScript("ada@example.com", "monthly");
      const adminId = await createAccount(test, "admin@example.com");
      const revoked = await revokeManualGrant(test.ctx, { grantId, adminId });
      expect(revoked).toMatchObject({ ok: true, value: { status: "trial", endsAt: TRIAL_END } });
    });

    it.each([
      ["an undeclared plan", { email: "ada@example.com", plan: "weekly" }, 'plan "weekly" is not declared (declared: monthly, lifetime)'],
      ["an unknown email", { email: "nobody@example.com", plan: "monthly" }, "no account has this email"],
    ])("refuses %s and writes nothing", async (_case, args, reason) => {
      const outcome = await executeOpsScript(test.database.db, grant(), args, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason });
      expect(await readGrants(test)).toEqual([]);
    });

    it("refuses an account with lifetime access and writes nothing", async () => {
      await grantByScript("ada@example.com", "lifetime");
      const outcome = await executeOpsScript(test.database.db, grant(), { email: "ada@example.com", plan: "monthly" }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: "the account has lifetime access already" });
      expect((await readGrants(test)).map((row) => row.plan_id)).toEqual(["lifetime"]);
      expect(await readRow(test, adaId)).toMatchObject({ is_lifetime: true, paid_until: null });
    });

    it("runs as a command and never prints the email", async () => {
      const lines: string[] = [];
      const output = { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) };
      const code = await runOpsScript({
        script: grant(),
        argv: ["--email=ada@example.com", "--plan=monthly", "--commit"],
        config: test.config,
        database: test.database.db,
        output,
      });
      expect(code).toBe(0);
      expect(lines.at(-1)).toBe("COMMITTED");
      expect(lines.join("\n")).not.toContain("ada@example.com");
      expect(await readGrants(test)).toHaveLength(1);
    });
  });

  describe("revoke-grant", () => {
    it("writes nothing on a dry run and reports what the revoke takes back", async () => {
      const grantId = await grantByScript("ada@example.com", "monthly");
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: grantId }, { commit: false });
      expect(outcome).toMatchObject({
        ok: true,
        value: {
          committed: false,
          report: {
            before: { userId: adaId, access: { status: "paid", endsAt: MONTH_AFTER_TRIAL }, grants: [{ id: grantId, planId: "monthly" }] },
            after: { userId: adaId, access: { status: "trial", endsAt: TRIAL_END }, grants: [] },
          },
        },
      });
      expect(await readGrants(test)).toMatchObject([{ id: grantId, status: "active" }]);
    });

    it("revokes the grant with --commit and takes back its period", async () => {
      const grantId = await grantByScript("ada@example.com", "monthly");
      test.clock.set(LATER);
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: grantId }, { commit: true });
      expect(outcome).toMatchObject({ ok: true, value: { committed: true } });
      expect(await readGrants(test)).toEqual([{ id: grantId, plan_id: "monthly", granted_by: null, granted_at: NOW, status: "revoked", revoked_at: LATER, revoked_by: null }]);
      expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial", endsAt: TRIAL_END });
    });

    it("revokes a grant made in the admin page", async () => {
      const adminId = await createAccount(test, "admin@example.com");
      const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId });
      if (!granted.ok) throw new Error(`setup: grant failed with ${granted.error}`);
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: granted.value.grantId }, { commit: true });
      expect(outcome).toMatchObject({ ok: true, value: { report: { before: { access: { status: "paid", endsAt: null } }, after: { access: { status: "trial" } } } } });
      expect(await readRow(test, adaId)).toMatchObject({ is_lifetime: false });
    });

    it("refuses an unknown email", async () => {
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "nobody@example.com", grant: UNKNOWN_ID }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: "no account has this email" });
    });

    it.each([
      ["an unknown id", UNKNOWN_ID],
      ["an id that is not a uuid", "not-a-uuid"],
    ])("refuses %s and writes nothing", async (_case, id) => {
      const grantId = await grantByScript("ada@example.com", "monthly");
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: id }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: `the account has no active manual grant "${id}"` });
      expect(await readGrants(test)).toMatchObject([{ id: grantId, status: "active" }]);
    });

    it("refuses another account's grant, leaving it active", async () => {
      await createAccount(test, "eve@example.com");
      const grantId = await grantByScript("eve@example.com", "monthly");
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: grantId }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: `the account has no active manual grant "${grantId}"` });
      expect(await readGrants(test)).toMatchObject([{ id: grantId, status: "active" }]);
    });

    it("refuses a grant revoked before", async () => {
      const grantId = await grantByScript("ada@example.com", "monthly");
      await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: grantId }, { commit: true });
      const outcome = await executeOpsScript(test.database.db, revoke(), { email: "ada@example.com", grant: grantId }, { commit: true });
      expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: `the account has no active manual grant "${grantId}"` });
      expect(await revokeManualGrant(test.ctx, { grantId, adminId: null })).toEqual(err("billing.grant_revoked"));
    });
  });
});
