import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { computeChecksum, describeProblem, readMigrationFiles, type MigrationProblem } from "@softure-ai/db";

const ROLLBACK = "-- Rollback: DROP TABLE t;\n";
const createdDirs: string[] = [];

function createFolder(files: Record<string, string>): URL {
  const dir = mkdtempSync(join(tmpdir(), "softure-db-files-"));
  createdDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return pathToFileURL(`${dir}/`);
}

async function readProblems(dir: URL): Promise<MigrationProblem[]> {
  const result = await readMigrationFiles("notes", dir);
  if (result.ok) throw new Error("expected problems");
  return [...result.problems];
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("readMigrationFiles", () => {
  it("returns the SQL files sorted by number and ignores other files", async () => {
    const dir = createFolder({
      "0002_add_index.sql": `${ROLLBACK}CREATE INDEX i ON t (id);\n`,
      "0001_create_t.sql": `${ROLLBACK}CREATE TABLE t (id int);\n`,
      "README.md": "# Migrations\n",
    });

    const result = await readMigrationFiles("notes", dir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((file) => [file.version, file.name, file.fileName])).toEqual([
      [1, "create_t", "0001_create_t.sql"],
      [2, "add_index", "0002_add_index.sql"],
    ]);
    expect(result.value[0]?.checksum).toBe(computeChecksum(`${ROLLBACK}CREATE TABLE t (id int);\n`));
  });

  it("gives a CRLF file and a BOM file the same checksum as the LF file", async () => {
    const lf = `${ROLLBACK}CREATE TABLE t (id int);\n`;
    const crlf = createFolder({ "0001_create_t.sql": `\uFEFF${lf.replace(/\n/g, "\r\n")}` });

    const result = await readMigrationFiles("notes", crlf);

    expect(result.ok && result.value[0]?.checksum).toBe(computeChecksum(lf));
    expect(computeChecksum(lf)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts an empty folder as a module without migrations yet", async () => {
    const result = await readMigrationFiles("notes", createFolder({}));

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("reports a missing folder instead of throwing", async () => {
    const missing = new URL("./missing/", createFolder({}));

    const [problem] = await readProblems(missing);

    expect(problem?.code).toBe("db.migrations_unreadable");
    expect(problem && describeProblem(problem)).toContain("the folder does not exist");
  });

  it.each([
    ["1_create_t.sql", "four digits"],
    ["0001_Create-T.sql", "lower_snake_case"],
    ["0000_create_t.sql", "starts at 0001"],
  ])("rejects the file name %s", async (fileName, reason) => {
    const [problem] = await readProblems(createFolder({ [fileName]: `${ROLLBACK}SELECT 1;\n` }));

    expect(problem).toMatchObject({ code: "db.invalid_migration_file", module: "notes", file: fileName });
    expect(problem?.code === "db.invalid_migration_file" && problem.reason).toContain(reason);
  });

  it("rejects a file without a leading rollback comment", async () => {
    const problems = await readProblems(
      createFolder({ "0001_create_t.sql": "CREATE TABLE t (id int);\n-- Rollback: DROP TABLE t;\n" }),
    );

    expect(problems).toEqual([expect.objectContaining({ code: "db.invalid_migration_file", file: "0001_create_t.sql" })]);
    expect(describeProblem(problems[0] as MigrationProblem)).toContain("rollback plan");
  });

  it("accepts the rollback note anywhere in the leading comment block", async () => {
    const dir = createFolder({ "0001_create_t.sql": "\n-- Creates t.\n-- rollback: DROP TABLE t;\nCREATE TABLE t (id int);\n" });

    expect((await readMigrationFiles("notes", dir)).ok).toBe(true);
  });

  it.each(["BEGIN;", "commit;", "ROLLBACK WORK;", "start transaction isolation level serializable;"])(
    "rejects a file with the transaction statement %s",
    async (statement) => {
      const [problem] = await readProblems(createFolder({ "0001_a.sql": `${ROLLBACK}${statement}\nSELECT 1;\n` }));

      expect(problem?.code === "db.invalid_migration_file" && problem.reason).toContain("must not control transactions");
    },
  );

  it("accepts PL/pgSQL blocks with BEGIN and END;", async () => {
    const body = "CREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $$\nBEGIN\n  RETURN 1;\nEND;\n$$;\n";

    expect((await readMigrationFiles("notes", createFolder({ "0001_a.sql": `${ROLLBACK}${body}` }))).ok).toBe(true);
  });

  it("rejects a gap and a repeated number", async () => {
    const gap = await readProblems(
      createFolder({ "0001_a.sql": `${ROLLBACK}SELECT 1;`, "0003_c.sql": `${ROLLBACK}SELECT 1;` }),
    );
    const repeat = await readProblems(
      createFolder({ "0001_a.sql": `${ROLLBACK}SELECT 1;`, "0001_b.sql": `${ROLLBACK}SELECT 1;` }),
    );

    expect(gap).toEqual([expect.objectContaining({ file: "0003_c.sql", reason: "breaks the sequence: expected number 0002" })]);
    expect(repeat).toEqual([expect.objectContaining({ file: "0001_b.sql", reason: "repeats number 0001" })]);
  });

  it("ignores folders named like migrations", async () => {
    const dir = createFolder({ "0001_a.sql": `${ROLLBACK}SELECT 1;` });
    mkdirSync(new URL("./0002_b.sql/", dir));

    const result = await readMigrationFiles("notes", dir);

    expect(result.ok && result.value.length).toBe(1);
  });
});
