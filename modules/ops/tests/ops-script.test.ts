// The safe ops script helper, driven by a small script that renames a note: the guard test pattern
// every app script follows (run the real script on a test database, with and without commit).
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import type { Queryable } from "@softure-ai/db";
import {
  defineOpsScript,
  executeOpsScript,
  parseOpsArguments,
  refuseOpsScript,
  runOpsScript,
} from "@softure-ai/ops/scripts";
import { ok } from "@softure-ai/core";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

interface Note {
  readonly id: number;
  readonly title: string;
}

async function findNote(tx: Queryable, id: number): Promise<Note[]> {
  const result = await tx.execute<{ id: number; title: string }>(sql`select id, title from notes where id = ${id}`);
  return result.rows.map((row) => ({ id: row.id, title: row.title }));
}

const renameNote = defineOpsScript({
  name: "rename-note",
  description: "Renames one note.",
  usage: ["--id=<number>   the note", "--title=<text>  its new title"],
  args: z.strictObject({ id: z.coerce.number().int().positive(), title: z.string().min(1).max(100) }),
  run: async (tx, args) => {
    const before = await findNote(tx, args.id);
    if (before.length !== 1) {
      return refuseOpsScript(`expected 1 note with id ${String(args.id)}, found ${String(before.length)}`);
    }
    await tx.execute(sql`update notes set title = ${args.title} where id = ${args.id}`);
    return ok({ before: before[0], after: (await findNote(tx, args.id))[0] });
  },
});

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await database.client.exec("create table notes (id int primary key, title text not null)");
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  await database.client.exec("delete from notes; insert into notes values (1, 'first'), (2, 'second')");
});

async function titles(): Promise<string[]> {
  const result = await database.client.query<{ title: string }>("select title from notes order by id");
  return result.rows.map((row) => row.title);
}

describe("executeOpsScript", () => {
  it("rolls a dry run back and still reports what it would change", async () => {
    const outcome = await executeOpsScript(database.db, renameNote, { id: 1, title: "renamed" }, { commit: false });
    expect(outcome).toEqual({
      ok: true,
      value: { committed: false, report: { before: { id: 1, title: "first" }, after: { id: 1, title: "renamed" } } },
    });
    expect(await titles()).toEqual(["first", "second"]);
  });

  it("writes with commit and touches nothing else", async () => {
    const outcome = await executeOpsScript(database.db, renameNote, { id: 1, title: "renamed" }, { commit: true });
    expect(outcome).toMatchObject({ ok: true, value: { committed: true } });
    expect(await titles()).toEqual(["renamed", "second"]);
  });

  it("returns the script's refusal and writes nothing, also with commit", async () => {
    const outcome = await executeOpsScript(database.db, renameNote, { id: 9, title: "x" }, { commit: true });
    expect(outcome).toEqual({ ok: false, error: "ops.script_refused", reason: "expected 1 note with id 9, found 0" });
    expect(await titles()).toEqual(["first", "second"]);
  });

  it("rolls back every change made before the script threw", async () => {
    const failing = defineOpsScript({
      ...renameNote,
      name: "rename-then-fail",
      run: async (tx) => {
        await tx.execute(sql`update notes set title = 'half done'`);
        throw new Error("second step failed");
      },
    });
    await expect(executeOpsScript(database.db, failing, { id: 1, title: "x" }, { commit: true })).rejects.toThrow("second step failed");
    expect(await titles()).toEqual(["first", "second"]);
  });

  it("refuses a report without before or after, and writes nothing", async () => {
    const unmeasured = defineOpsScript({
      ...renameNote,
      name: "unmeasured",
      run: async (tx) => {
        await tx.execute(sql`update notes set title = 'unmeasured'`);
        return ok({ before: undefined, after: [] });
      },
    });
    await expect(executeOpsScript(database.db, unmeasured, { id: 1, title: "x" }, { commit: true })).rejects.toThrow(
      'ops script "unmeasured": run must return both before and after; nothing was written',
    );
    expect(await titles()).toEqual(["first", "second"]);
  });
});

describe("runOpsScript", () => {
  async function run(argv: string[]) {
    const lines: string[] = [];
    const errors: string[] = [];
    const code = await runOpsScript({
      script: renameNote,
      argv,
      config: { database: null },
      database: database.db,
      output: { log: (line) => lines.push(line), error: (line) => errors.push(line) },
    });
    return { code, lines, errors };
  }

  it("is a dry run without --commit", async () => {
    const result = await run(["--id=1", "--title=renamed"]);
    expect(result).toEqual({
      code: 0,
      lines: [
        "rename-note: dry run: nothing will be written",
        'before: {"id":1,"title":"first"}',
        'after:  {"id":1,"title":"renamed"}',
        "DRY RUN: rolled back, nothing was written. Add --commit to write.",
      ],
      errors: [],
    });
    expect(await titles()).toEqual(["first", "second"]);
  });

  it("writes with --commit", async () => {
    const result = await run(["--id=2", "--title=renamed", "--commit"]);
    expect(result.code).toBe(0);
    expect(result.lines.at(0)).toBe("rename-note: --commit: changes will be written");
    expect(result.lines.at(-1)).toBe("COMMITTED");
    expect(await titles()).toEqual(["first", "renamed"]);
  });

  it("exits 1 on a refusal", async () => {
    const result = await run(["--id=7", "--title=x", "--commit"]);
    expect(result.code).toBe(1);
    expect(result.errors).toEqual(["rename-note: refused: expected 1 note with id 7, found 0", "nothing was written"]);
  });

  it("exits 1 on a database error without printing its query", async () => {
    const broken = defineOpsScript({
      ...renameNote,
      name: "broken",
      run: async (tx) => {
        await tx.execute(sql`select * from "missing_table" where secret = ${"hidden"}`);
        return ok({ before: 1, after: 1 });
      },
    });
    const errors: string[] = [];
    const code = await runOpsScript({
      script: broken,
      argv: ["--id=1", "--title=x"],
      config: { database: null },
      database: database.db,
      output: { log: () => undefined, error: (line) => errors.push(line) },
    });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/^broken: failed: database error \(\w+/);
    expect(errors.join("\n")).not.toContain("hidden");
  });

  it.each([
    [["--id=1"], "rename-note: --title: Invalid input: expected string, received undefined"],
    [["--id=one", "--title=x"], "rename-note: --id: Invalid input: expected number, received NaN"],
    [["--id=1", "--title=x", "--force"], 'rename-note: Unrecognized key: "force"'],
    [["--id=1", "--id=2", "--title=x"], "rename-note: --id is given twice"],
    [["1", "--title=x"], 'rename-note: unexpected argument "1"; arguments look like --key=value'],
    [["--commit=yes"], "rename-note: --commit takes no value"],
  ])("exits 2 with usage on %j", async (argv, message) => {
    const result = await run(argv);
    expect(result.code).toBe(2);
    expect(result.errors[0]).toBe(message);
    expect(result.errors.at(-1)).toContain("Usage: rename-note [arguments] [--commit]");
    expect(await titles()).toEqual(["first", "second"]);
  });

  it("prints the usage with --help and changes nothing", async () => {
    const result = await run(["--help", "--commit"]);
    expect(result.code).toBe(0);
    expect(result.lines.join("\n")).toBe(
      [
        "Usage: rename-note [arguments] [--commit]",
        "",
        "Renames one note.",
        "",
        "Arguments:",
        "  --id=<number>   the note",
        "  --title=<text>  its new title",
        "  --commit    write the change; without it the script runs and rolls back (dry run)",
        "  --help      show this help",
      ].join("\n"),
    );
  });

  it("exits 1 when the config has no database", async () => {
    const errors: string[] = [];
    const code = await runOpsScript({
      script: renameNote,
      argv: ["--id=1", "--title=x"],
      config: { database: null },
      output: { log: () => undefined, error: (line) => errors.push(line) },
    });
    expect(code).toBe(1);
    expect(errors).toEqual(["rename-note: the config has no database; set database.url in softure.config"]);
  });
});

describe("parseOpsArguments", () => {
  it("takes flags without a value as true and keeps values with = signs", () => {
    expect(parseOpsArguments(["--dry", "--where=a=b"])).toEqual({
      ok: true,
      value: { commit: false, help: false, values: { dry: true, where: "a=b" } },
    });
  });
});

describe("defineOpsScript", () => {
  it("refuses a name that is not kebab-case", () => {
    expect(() => defineOpsScript({ ...renameNote, name: "Rename_Note" })).toThrow('"Rename_Note" is not a kebab-case script name');
  });

  it("refuses an empty description", () => {
    expect(() => defineOpsScript({ ...renameNote, description: " " })).toThrow('script "rename-note" needs a description');
  });
});
