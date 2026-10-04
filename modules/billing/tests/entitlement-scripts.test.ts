// The import-entitlements and pin-trials ops scripts on PGlite: a dry run writes nothing and reports
// the change, `--commit` writes, every refusal writes nothing, and the command never prints an email.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createImportEntitlementsScript, createPinTrialsScript, MAX_IMPORT_ROWS } from "@softure-ai/billing/scripts";
import { getEntitlement } from "@softure-ai/billing/server";
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

/** Midnight starting 1 December in Warsaw (CET). */
const PAID_END = new Date("2026-11-30T23:00:00Z");
/** The end of a 14-day trial begun at NOW. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");

describe("the entitlement scripts", () => {
  let test: TestBilling;
  let folder: string;
  let adaId: string;
  let oldId: string;

  function importScript() {
    return createImportEntitlementsScript(test.config, { clock: test.clock });
  }

  function pinScript() {
    return createPinTrialsScript(test.config, { clock: test.clock });
  }

  async function writeImportFile(content: unknown): Promise<string> {
    const path = join(folder, `import-${String(Math.random()).slice(2)}.json`);
    await writeFile(path, typeof content === "string" ? content : JSON.stringify(content));
    return path;
  }

  async function countRows(): Promise<number> {
    const result = await test.database.client.query<{ total: number }>("SELECT count(*)::int AS total FROM billing.entitlements");
    return result.rows[0]?.total ?? -1;
  }

  beforeEach(async () => {
    test = await createTestBilling();
    folder = await mkdtemp(join(tmpdir(), "billing-import-"));
    adaId = await createAccount(test, "ada@example.com");
    test.clock.set(new Date("2026-08-01T08:00:00Z"));
    oldId = await createAccount(test, "old@example.com");
    test.clock.set(NOW);
  });
  afterEach(async () => {
    await test.database.close();
    await rm(folder, { recursive: true, force: true });
  });

  describe("import-entitlements", () => {
    it("writes nothing on a dry run and reports how the imported accounts stand", async () => {
      const file = await writeImportFile([
        { email: "old@example.com", paidUntil: "2026-12-01T00:00:00+01:00" },
        { email: "ada@example.com", isLifetime: true },
      ]);
      const outcome = await executeOpsScript(test.database.db, importScript(), { file }, { commit: false });
      expect(outcome).toEqual({
        ok: true,
        value: {
          committed: false,
          report: {
            before: { accounts: 2, trial: 1, paid: 0, lifetime: 0, readOnly: 1 },
            after: { accounts: 2, trial: 0, paid: 1, lifetime: 1, readOnly: 0 },
          },
        },
      });
      expect(await countRows()).toBe(0);
    });

    it("records each row with --commit, finding accounts whatever the email's case, and a repeat changes nothing", async () => {
      const file = await writeImportFile([
        { email: " OLD@Example.com", trialEndsAt: "2026-08-20T00:00:00+02:00", paidUntil: "2026-12-01T00:00:00+01:00" },
        { email: "ada@example.com", trialEndsAt: "2026-10-31T00:00:00+02:00", paidUntil: null },
      ]);
      expect(await executeOpsScript(test.database.db, importScript(), { file }, { commit: true })).toMatchObject({ ok: true, value: { committed: true } });
      expect(await readRow(test, oldId)).toMatchObject({ trial_ends_at: new Date("2026-08-19T22:00:00Z"), paid_until: PAID_END, is_lifetime: false });
      expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: new Date("2026-10-30T22:00:00Z"), paid_until: null });
      expect(await getEntitlement(test.ctx, oldId)).toMatchObject({ status: "paid", endsAt: PAID_END });

      const again = await executeOpsScript(test.database.db, importScript(), { file }, { commit: true });
      expect(again).toMatchObject({ ok: true, value: { report: { before: { paid: 1, trial: 1 }, after: { paid: 1, trial: 1 } } } });
      expect(await readRow(test, oldId)).toMatchObject({ paid_until: PAID_END });
    });

    it.each([
      ["a missing file", null, /^cannot read the file ".*missing\.json" \(ENOENT\)$/],
      ["invalid JSON", "[{", /^the file ".*" is not valid JSON$/],
      ["an object instead of an array", { email: "ada@example.com" }, /^the file must be a JSON array of .*: the file Invalid input: expected array, received object$/],
      ["an empty array", [], /: the file holds no rows$/],
      ["a row without a field to import", [{ email: "ada@example.com" }], /: row 1: needs trialEndsAt, paidUntil or isLifetime$/],
      ["a date without an offset", [{ email: "ada@example.com", paidUntil: "2026-12-01" }], /: row 1 paidUntil: must be an ISO 8601 date-time with an offset/],
      ["an unknown key", [{ email: "ada@example.com", isLifetime: true, plan: "monthly" }], /: row 1: Unrecognized key: "plan"$/],
      [
        "an email repeated in another case",
        [
          { email: "ada@example.com", isLifetime: true },
          { email: "old@example.com", isLifetime: true },
          { email: "ADA@example.com", isLifetime: true },
        ],
        /^row 3 repeat an email named earlier in the file$/,
      ],
      [
        "emails that name no account",
        [
          { email: "ada@example.com", isLifetime: true },
          { email: "nobody@example.com", isLifetime: true },
          { email: "ghost@example.com", isLifetime: true },
        ],
        /^rows 2, 3 name no account; nothing was imported$/,
      ],
    ])("refuses %s and writes nothing", async (_case, content, reason) => {
      const file = content === null ? join(folder, "missing.json") : await writeImportFile(content);
      const outcome = await executeOpsScript(test.database.db, importScript(), { file }, { commit: true });
      expect(outcome).toMatchObject({ ok: false, error: "ops.script_refused" });
      expect(outcome.ok ? "" : outcome.reason).toMatch(reason);
      expect(await countRows()).toBe(0);
    });

    it("lists at most ten rows in a refusal", async () => {
      const rows = Array.from({ length: 13 }, (_, index) => ({ email: `nobody${String(index)}@example.com`, isLifetime: true }));
      const outcome = await executeOpsScript(test.database.db, importScript(), { file: await writeImportFile(rows) }, { commit: true });
      expect(outcome).toMatchObject({ ok: false, reason: "rows 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 3 more name no account; nothing was imported" });
    });

    it("refuses a file over the row limit", async () => {
      const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ email: "ada@example.com", isLifetime: true }));
      const outcome = await executeOpsScript(test.database.db, importScript(), { file: await writeImportFile(rows) }, { commit: true });
      expect(outcome).toMatchObject({ ok: false, reason: expect.stringMatching(/: the file holds more than 50000 rows; split it$/) as unknown });
    });

    it("runs as a command and never prints an email", async () => {
      const file = await writeImportFile([{ email: "old@example.com", paidUntil: "2026-12-01T00:00:00+01:00" }]);
      const lines: string[] = [];
      const output = { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) };
      const code = await runOpsScript({ script: importScript(), argv: [`--file=${file}`, "--commit"], config: test.config, database: test.database.db, output });
      expect(code).toBe(0);
      expect(lines.at(-1)).toBe("COMMITTED");
      expect(lines.join("\n")).not.toContain("@example.com");

      const refused: string[] = [];
      const missing = await writeImportFile([{ email: "nobody@example.com", isLifetime: true }]);
      const refusedOutput = { log: (line: string) => refused.push(line), error: (line: string) => refused.push(line) };
      expect(await runOpsScript({ script: importScript(), argv: [`--file=${missing}`], config: test.config, database: test.database.db, output: refusedOutput })).toBe(1);
      expect(refused.join("\n")).not.toContain("@example.com");
    });
  });

  describe("pin-trials", () => {
    it("writes nothing on a dry run and reports the accounts it would pin", async () => {
      const outcome = await executeOpsScript(test.database.db, pinScript(), {}, { commit: false });
      expect(outcome).toEqual({ ok: true, value: { committed: false, report: { before: { accountsWithoutRow: 2 }, after: { accountsWithoutRow: 0, pinned: 2 } } } });
      expect(await countRows()).toBe(0);
    });

    it("pins every derived trial with --commit and refuses arguments", async () => {
      const code = await runOpsScript({ script: pinScript(), argv: ["--commit"], config: test.config, database: test.database.db, output: { log: () => undefined, error: () => undefined } });
      expect(code).toBe(0);
      expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: TRIAL_END, created_at: NOW });
      expect(await readRow(test, oldId)).toMatchObject({ trial_ends_at: new Date("2026-08-14T22:00:00Z") });
      expect(await executeOpsScript(test.database.db, pinScript(), {}, { commit: true })).toMatchObject({
        ok: true,
        value: { report: { before: { accountsWithoutRow: 0 }, after: { accountsWithoutRow: 0, pinned: 0 } } },
      });
      const usage = await runOpsScript({ script: pinScript(), argv: ["--days=3"], config: test.config, database: test.database.db, output: { log: () => undefined, error: () => undefined } });
      expect(usage).toBe(2);
    });
  });
});
