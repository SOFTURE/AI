// `runOpsMain`: the one-call entry of an ops script, for apps whose `softure.config.ts` arrives as a
// CommonJS-wrapped module (no `"type": "module"`, loaded by tsx) as well as for ESM apps.
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import type { Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, runOpsMain, type RunOpsMainOptions } from "@softure-ai/ops/scripts";
import { ok } from "@softure-ai/core";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig } from "./support.js";

async function findTitle(tx: Queryable, id: number): Promise<string[]> {
  const result = await tx.execute<{ title: string }>(sql`select title from notes where id = ${id}`);
  return result.rows.map((row) => row.title);
}

const renameNote = defineOpsScript({
  name: "rename-note",
  description: "Renames one note.",
  usage: ["--id=<number>   the note", "--title=<text>  its new title"],
  args: z.strictObject({ id: z.coerce.number().int().positive(), title: z.string().min(1).max(100) }),
  run: async (tx, args) => {
    const before = await findTitle(tx, args.id);
    if (before.length !== 1) return refuseOpsScript(`expected 1 note, found ${String(before.length)}`);
    await tx.execute(sql`update notes set title = ${args.title} where id = ${args.id}`);
    return ok({ before: { title: before[0] }, after: { title: (await findTitle(tx, args.id))[0] } });
  },
});

const config = createConfig({ databaseUrl: null });

let database: TestDatabase;
let savedExitCode: typeof process.exitCode;

beforeAll(async () => {
  database = await createTestDatabase();
  await database.client.exec("create table notes (id int primary key, title text not null)");
});
afterAll(async () => {
  await database.close();
});
beforeEach(async () => {
  savedExitCode = process.exitCode;
  process.exitCode = undefined;
  await database.client.exec("delete from notes; insert into notes values (1, 'first')");
});
afterEach(() => {
  process.exitCode = savedExitCode;
});

async function title(): Promise<string> {
  const result = await database.client.query<{ title: string }>("select title from notes where id = 1");
  return result.rows[0]?.title ?? "";
}

async function run(configModule: unknown, options: Partial<RunOpsMainOptions> = {}) {
  const lines: string[] = [];
  const errors: string[] = [];
  const code = await runOpsMain(renameNote, configModule, {
    argv: ["--id=1", "--title=renamed", "--commit"],
    database: database.db,
    output: { log: (line) => lines.push(line), error: (line) => errors.push(line) },
    ...options,
  });
  return { code, exitCode: process.exitCode, lines, errors };
}

describe("runOpsMain", () => {
  it.each([
    ["the config itself", config],
    ["a CommonJS-wrapped default export", { default: config }],
    ["a doubly wrapped default export", { default: { default: config } }],
    ["a named config export", { config }],
  ])("runs the script from %s and sets the exit code", async (_label, configModule) => {
    const result = await run(configModule);
    expect(result).toMatchObject({ code: 0, exitCode: 0, errors: [] });
    expect(result.lines.at(-1)).toBe("COMMITTED");
    expect(await title()).toBe("renamed");
  });

  it("is a dry run without --commit", async () => {
    const result = await run({ default: config }, { argv: ["--id=1", "--title=renamed"] });
    expect(result.exitCode).toBe(0);
    expect(await title()).toBe("first");
  });

  it("refuses a module without a config and runs nothing", async () => {
    const result = await run({ default: { notAConfig: true } });
    expect(result).toEqual({
      code: 1,
      exitCode: 1,
      lines: [],
      errors: ["rename-note: the config module exports no Softure config (default or `config`); pass the module of softure.config"],
    });
    expect(await title()).toBe("first");
  });

  it("sets the usage exit code on a usage error", async () => {
    const result = await run({ default: config }, { argv: ["--id=1"] });
    expect(result).toMatchObject({ code: 2, exitCode: 2 });
    expect(result.errors[0]).toBe("rename-note: --title: Invalid input: expected string, received undefined");
  });

  it("turns an unexpected throw into one line and exit code 1", async () => {
    const result = await run(
      { default: config },
      {
        output: {
          log: () => {
            throw new Error("stdout closed");
          },
          error: () => undefined,
        },
      },
    );
    expect(result).toMatchObject({ code: 1, exitCode: 1 });
  });
});
