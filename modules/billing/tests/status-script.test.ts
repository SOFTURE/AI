// The entitlement-status ops script on PGlite: it reports where one account stands (state, trial and
// paid last days in the app's time zone, lifetime) by user id, writes nothing with or without
// `--commit`, refuses an unknown account, and never prints the email.
import { createEntitlementStatusScript, type EntitlementStatusScriptArgs } from "@softure-ai/billing/scripts";
import { changeEntitlement } from "@softure-ai/billing/server";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, readRow, type TestBilling } from "./support.js";

/** The end of the 14-day trial begun at NOW (16 October, Warsaw, is its last day). */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Paid through 30 November (Warsaw). */
const PAID_END = new Date("2026-11-30T23:00:00Z");
/** 20 October 2026, 10:00 in Warsaw: the trial ended when the day began three days earlier. */
const AFTER_TRIAL = new Date("2026-10-20T08:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("the entitlement-status script", () => {
  let test: TestBilling;
  let adaId: string;

  function execute(args: EntitlementStatusScriptArgs, commit: boolean) {
    return executeOpsScript(test.database.db, createEntitlementStatusScript(test.config, { clock: test.clock }), args, { commit });
  }

  async function run(argv: readonly string[]): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    const output = { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) };
    const script = createEntitlementStatusScript(test.config, { clock: test.clock });
    const code = await runOpsScript({ script, argv, config: test.config, database: test.database.db, output });
    return { code, lines };
  }

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("reports a trial by user id with its last day, the same before and after", async () => {
    const status = {
      userId: adaId,
      state: "trial",
      trialLastDay: "2026-10-16",
      paidLastDay: null,
      isLifetime: false,
      access: { status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false },
    };
    expect(await execute({ email: "ada@example.com" }, false)).toEqual({ ok: true, value: { committed: false, report: { before: status, after: status } } });
  });

  it("reports dated paid access, lifetime access and an ended trial", async () => {
    expect((await changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END })).ok).toBe(true);
    expect(await execute({ user: adaId }, false)).toMatchObject({
      value: { report: { after: { state: "paid", trialLastDay: "2026-10-16", paidLastDay: "2026-11-30", isLifetime: false } } },
    });

    expect((await changeEntitlement(test.ctx, adaId, { type: "grant_lifetime" })).ok).toBe(true);
    expect(await execute({ user: adaId }, false)).toMatchObject({ value: { report: { after: { state: "lifetime", paidLastDay: "2026-11-30", isLifetime: true } } } });

    const bob = await createAccount(test, "bob@example.com");
    test.clock.set(AFTER_TRIAL);
    expect(await execute({ user: bob }, false)).toMatchObject({
      value: { report: { after: { state: "read_only", trialLastDay: "2026-10-16", paidLastDay: null, access: { status: "read_only", reason: "trial_ended" } } } },
    });
  });

  it("writes nothing with --commit: an account without a row keeps none", async () => {
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await execute({ email: "ada@example.com" }, true)).toMatchObject({ ok: true, value: { committed: true } });
    expect(await readRow(test, adaId)).toBeUndefined();
  });

  it("refuses an unknown email or id", async () => {
    expect(await execute({ email: "nobody@example.com" }, false)).toMatchObject({ ok: false, reason: "no account has this email or id" });
    expect(await execute({ user: UNKNOWN_ID }, false)).toMatchObject({ ok: false, reason: "no account has this email or id" });
    expect(await execute({ user: "not-a-uuid" }, false)).toMatchObject({ ok: false, reason: "no account has this email or id" });
  });

  it("asks for exactly one of --email and --user before opening the database", async () => {
    const { code, lines } = await run(["--email=ada@example.com", `--user=${adaId}`]);
    expect(code).toBe(2);
    expect(lines[0]).toBe("entitlement-status: give exactly one of --email=<account email> and --user=<account id>");
  });

  it("prints the status by user id and never the email", async () => {
    const { code, lines } = await run(["--email=ada@example.com"]);
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain(adaId);
    expect(lines.join("\n")).toContain("2026-10-16");
    expect(lines.join("\n")).not.toContain("ada@example.com");
  });
});
