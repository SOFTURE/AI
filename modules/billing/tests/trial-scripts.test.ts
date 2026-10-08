// The extend-trial ops script on PGlite: a dry run writes nothing and reports the change, `--commit`
// extends the trial through `extendTrialManually` (recorded without an admin, listed in the
// history), `--days` adds days of access after the current last day (from today for an ended
// trial), `--until` is the new last day, refusals write nothing, usage errors stop before the
// database, and the command never prints the email.
import { createExtendTrialScript, MAX_EXTEND_DAYS, type ExtendTrialScriptArgs } from "@softure-ai/billing/scripts";
import { getAccountHistory } from "@softure-ai/billing/server";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

/** The end of the 14-day trial begun at NOW (16 October, Warsaw, is its last day). */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Ten days after the trial's end: through 26 October (Warsaw, CET from 25 October). */
const TEN_DAYS_AFTER_TRIAL = new Date("2026-10-26T23:00:00Z");
/** Through 31 October (Warsaw). */
const OCTOBER_END = new Date("2026-10-31T23:00:00Z");
/** 20 October 2026, 10:00 in Warsaw: the trial ended when the day began three days earlier. */
const AFTER_TRIAL = new Date("2026-10-20T08:00:00Z");
/** Ten days from 20 October, today counted: through 29 October (Warsaw). */
const TEN_DAYS_FROM_AFTER_TRIAL = new Date("2026-10-29T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

interface TrialExtensionRow {
  user_id: string;
  extended_by: string | null;
  extended_at: Date;
  previous_ends_at: Date;
  ends_at: Date;
}

async function readExtensions(test: TestBilling): Promise<TrialExtensionRow[]> {
  const result = await test.database.client.query<TrialExtensionRow>(
    "SELECT user_id, extended_by, extended_at, previous_ends_at, ends_at FROM billing.trial_extensions ORDER BY extended_at, ends_at",
  );
  return result.rows;
}

describe("the extend-trial script", () => {
  let test: TestBilling;
  let adaId: string;

  function extend() {
    return createExtendTrialScript(test.config, { clock: test.clock });
  }

  function execute(args: ExtendTrialScriptArgs, commit: boolean) {
    return executeOpsScript(test.database.db, extend(), args, { commit });
  }

  async function run(argv: readonly string[]): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    const output = { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) };
    const code = await runOpsScript({ script: extend(), argv, config: test.config, database: test.database.db, output });
    return { code, lines };
  }

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("writes nothing on a dry run and reports the trial end before and after by user id", async () => {
    const outcome = await execute({ email: "ada@example.com", days: 10 }, false);
    expect(outcome).toEqual({
      ok: true,
      value: {
        committed: false,
        report: {
          before: { userId: adaId, trialEndsAt: TRIAL_END, access: { status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false } },
          after: {
            userId: adaId,
            trialEndsAt: TEN_DAYS_AFTER_TRIAL,
            access: { status: "trial", endsAt: TEN_DAYS_AFTER_TRIAL, daysLeft: 24, isEnding: false },
            extensionId: expect.any(String) as unknown,
          },
        },
      },
    });
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await readExtensions(test)).toEqual([]);
  });

  it("on --commit extends the trial by days after its current end, recorded without an admin and listed in the history", async () => {
    const outcome = await execute({ email: "ada@example.com", days: 10 }, true);
    expect(outcome).toMatchObject({ ok: true, value: { committed: true, report: { after: { trialEndsAt: TEN_DAYS_AFTER_TRIAL } } } });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: TEN_DAYS_AFTER_TRIAL, paid_until: null, is_lifetime: false });
    expect(await readExtensions(test)).toEqual([{ user_id: adaId, extended_by: null, extended_at: NOW, previous_ends_at: TRIAL_END, ends_at: TEN_DAYS_AFTER_TRIAL }]);
    const extensionId = outcome.ok ? (outcome.value.report.after as { extensionId: string }).extensionId : "";
    expect(await getAccountHistory(test.ctx, adaId)).toEqual([{ source: "trial", id: extensionId, at: NOW, previousEndsAt: TRIAL_END, endsAt: TEN_DAYS_AFTER_TRIAL }]);
  });

  it("counts --days from today, today included, for a trial that already ended", async () => {
    test.clock.set(AFTER_TRIAL);
    const outcome = await execute({ email: "ada@example.com", days: 10 }, true);
    expect(outcome).toMatchObject({
      ok: true,
      value: { report: { before: { access: { status: "read_only" } }, after: { trialEndsAt: TEN_DAYS_FROM_AFTER_TRIAL, access: { status: "trial", daysLeft: 10 } } } },
    });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: TEN_DAYS_FROM_AFTER_TRIAL });
  });

  it("adds --days to the last day of a trial that ends in the middle of a day", async () => {
    // 16 October, 14:00 in Warsaw: the 16th is the last day of access, as for TRIAL_END.
    await test.database.client.query(
      "INSERT INTO billing.entitlements (user_id, trial_ends_at, created_at, updated_at) VALUES ($1, '2026-10-16T12:00:00Z', $2, $2)",
      [adaId, NOW],
    );
    expect(await execute({ email: "ada@example.com", days: 10 }, true)).toMatchObject({ ok: true, value: { report: { after: { trialEndsAt: TEN_DAYS_AFTER_TRIAL } } } });
  });

  it("takes --until as the trial's new last day and finds the account by --user", async () => {
    const outcome = await execute({ user: adaId, until: "2026-10-31" }, true);
    expect(outcome).toMatchObject({ ok: true, value: { committed: true, report: { before: { userId: adaId }, after: { trialEndsAt: OCTOBER_END } } } });
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: OCTOBER_END });
  });

  it.each([
    ["an unknown email", { email: "nobody@example.com", days: 10 }],
    ["an unknown account id", { user: UNKNOWN_ID, days: 10 }],
    ["an account id that is not a uuid", { user: "ada", days: 10 }],
  ] as const)("refuses %s and writes nothing", async (_case, args) => {
    expect(await execute(args, true)).toEqual({ ok: false, error: "ops.script_refused", reason: "no account has this email or id" });
    expect(await readExtensions(test)).toEqual([]);
  });

  it("refuses a last day the trial already reaches and writes nothing, not even the pinned row", async () => {
    expect(await execute({ email: "ada@example.com", until: "2026-10-16" }, true)).toEqual({
      ok: false,
      error: "ops.script_refused",
      reason: "the trial already lasts through 2026-10-16; the new last day must be later",
    });
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await readExtensions(test)).toEqual([]);
  });

  it("refuses a last day that has already passed and writes nothing", async () => {
    test.clock.set(AFTER_TRIAL);
    expect(await execute({ email: "ada@example.com", until: "2026-10-18" }, true)).toEqual({
      ok: false,
      error: "ops.script_refused",
      reason: "the new last day 2026-10-18 has already passed",
    });
    expect(await readRow(test, adaId)).toBeUndefined();
  });

  it("runs as a command, writes on --commit and never prints the email", async () => {
    const { code, lines } = await run(["--email=ada@example.com", "--days=10", "--commit"]);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe("COMMITTED");
    expect(lines.join("\n")).not.toContain("ada@example.com");
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: TEN_DAYS_AFTER_TRIAL });
  });

  it("is a dry run as a command without --commit", async () => {
    const { code, lines } = await run(["--user=" + adaId, "--until=2026-10-31"]);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe("DRY RUN: rolled back, nothing was written. Add --commit to write.");
    expect(await readRow(test, adaId)).toBeUndefined();
  });

  it.each([
    ["neither --email nor --user", ["--days=10"], "give exactly one of --email=<account email> and --user=<account id>"],
    ["both --email and --user", ["--email=ada@example.com", "--user=x", "--days=10"], "give exactly one of --email=<account email> and --user=<account id>"],
    ["neither --until nor --days", ["--email=ada@example.com"], "give exactly one of --until=YYYY-MM-DD and --days=<number>"],
    ["both --until and --days", ["--email=ada@example.com", "--until=2026-10-31", "--days=10"], "give exactly one of --until=YYYY-MM-DD and --days=<number>"],
    ["--days=0", ["--email=ada@example.com", "--days=0"], "--days must be at least 1"],
    ["--days=1.5", ["--email=ada@example.com", "--days=1.5"], "--days must be a whole number of days, 1 to 36500"],
    ["--days above the cap", ["--email=ada@example.com", `--days=${String(MAX_EXTEND_DAYS + 1)}`], "--days must be at most 36500"],
    ["a day that does not exist", ["--email=ada@example.com", "--until=2026-02-30"], "--until must be a calendar day, YYYY-MM-DD"],
  ] as const)("stops with a usage error on %s and writes nothing", async (_case, argv, message) => {
    const { code, lines } = await run(argv);
    expect(code).toBe(2);
    expect(lines.some((line) => line.includes(message))).toBe(true);
    expect(await readExtensions(test)).toEqual([]);
  });
});
