// The copy-account ops script: the account (by id or email) copied from the `--from` database into
// the app's database, a dry run unless committed, and refusals and usage errors that write nothing.
import { executeOpsScript, runOpsScript } from "@softure-ai/ops/scripts";
import { createCopyAccountScript } from "@softure-ai/privacy/scripts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrivacy, findTraces, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

const SOURCE_URL = "postgres://copy:secret@source.example/app";

describe("the copy-account script", () => {
  let source: TestPrivacy;
  let target: TestPrivacy;
  let ada: SeededUser;
  let openedUrls: string[];
  let closedCount: number;

  function createScript() {
    return createCopyAccountScript({
      exclude: ["auth.sessions"],
      openSource: (url) => {
        openedUrls.push(url);
        return Promise.resolve({
          db: source.database.db,
          close: () => {
            closedCount += 1;
            return Promise.resolve();
          },
        });
      },
    });
  }

  async function countAccounts(test: TestPrivacy, userId: string): Promise<number> {
    const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM auth.users WHERE id = $1", [userId]);
    return result.rows[0]?.count ?? 0;
  }

  beforeEach(async () => {
    source = await createTestPrivacy();
    target = await createTestPrivacy();
    ada = await seedUser(source, "ada@example.com");
    openedUrls = [];
    closedCount = 0;
  });
  afterEach(async () => {
    await source.database.close();
    await target.database.close();
  });

  it("writes nothing on a dry run and reports the tables it would copy", async () => {
    const outcome = await executeOpsScript(target.database.db, createScript(), { from: SOURCE_URL, user: ada.id }, { commit: false });

    expect(outcome).toMatchObject({
      ok: true,
      value: {
        committed: false,
        report: {
          before: { userId: ada.id, isInTarget: false },
          after: { userId: ada.id, isInTarget: true, tables: expect.arrayContaining([{ table: "auth.users", rows: 1, nulledReferences: 0 }]) as unknown },
        },
      },
    });
    expect(await findTraces(target.database, [ada.id, ada.email])).toEqual([]);
    expect(openedUrls).toEqual([SOURCE_URL]);
    expect(closedCount).toBe(1);
  });

  it("copies the account found by its email with --commit, leaving out the excluded tables", async () => {
    const outcome = await executeOpsScript(target.database.db, createScript(), { from: SOURCE_URL, email: " ADA@example.com" }, { commit: true });

    expect(outcome).toMatchObject({ ok: true, value: { committed: true } });
    expect(await countAccounts(target, ada.id)).toBe(1);
    const sessions = await target.database.client.query("SELECT 1 FROM auth.sessions WHERE user_id = $1", [ada.id]);
    expect(sessions.rows).toEqual([]);
    expect(closedCount).toBe(1);
  });

  it.each([
    ["an email no account has", { email: "nobody@example.com" }, "no account in the source has this email"],
    ["an unknown id", { user: "00000000-0000-4000-8000-00000000abcd" }, "privacy.copy_account_missing: auth.users has no row with id 00000000-0000-4000-8000-00000000abcd"],
  ])("refuses %s and writes nothing", async (_case, args, reason) => {
    const outcome = await executeOpsScript(target.database.db, createScript(), { from: SOURCE_URL, ...args }, { commit: true });
    expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason });
    expect(await findTraces(target.database, [ada.id, ada.email])).toEqual([]);
    expect(closedCount).toBe(1);
  });

  it("refuses an account the target already has", async () => {
    await executeOpsScript(target.database.db, createScript(), { from: SOURCE_URL, user: ada.id }, { commit: true });
    const outcome = await executeOpsScript(target.database.db, createScript(), { from: SOURCE_URL, user: ada.id }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, error: "ops.script_refused", reason: expect.stringMatching(/^privacy\.copy_account_exists: /) as unknown });
  });

  it("is a usage error without --from, or without exactly one of --user and --email, and opens no database", async () => {
    const errors: string[] = [];
    const output = { log: () => undefined, error: (line: string) => errors.push(line) };
    const run = (argv: string[]) => runOpsScript({ script: createScript(), argv, config: target.config, database: target.database.db, output });

    expect(await run([`--from=${SOURCE_URL}`])).toBe(2);
    expect(await run([`--from=${SOURCE_URL}`, `--user=${ada.id}`, "--email=ada@example.com"])).toBe(2);
    expect(await run([`--user=${ada.id}`])).toBe(2);
    expect(errors.filter((line) => line.startsWith("copy-account: --"))).toEqual([
      "copy-account: --user: give --user=<account id> or --email=<account email>",
      "copy-account: --user: give --user=<account id> or --email=<account email>, not both",
      "copy-account: --from: --from=<source database URL> is required",
    ]);
    expect(openedUrls).toEqual([]);
  });

  it("reads --from from a file, so the password stays off the command line", async () => {
    const readInput = { readFile: (path: string) => Promise.resolve(path === "/run/secrets/source-url" ? `${SOURCE_URL}\n` : ""), readStdin: () => Promise.resolve("") };
    const output = { log: () => undefined, error: () => undefined };
    const code = await runOpsScript({
      script: createScript(),
      argv: ["--from-file=/run/secrets/source-url", `--user=${ada.id}`],
      config: target.config,
      database: target.database.db,
      output,
      readInput,
    });
    expect(code).toBe(0);
    expect(openedUrls).toEqual([SOURCE_URL]);
  });
});
