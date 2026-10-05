import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkExportedMigrations,
  computeChecksum,
  describeProblem,
  migrate,
  readJournal,
  type JournalRow,
  type MigrationResult,
} from "@softure-ai/db";
import { LEDGER_FILES } from "../src/migrations/ledger.js";
import { withSession } from "../src/migrations/session.js";
import { createNotesModule, getFixtureMigrationsUrl } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** An export folder like `softure migrate --export-migrations` writes: `<root>/notes/0001_….sql`, `0002_….sql`. */
function createExport(): { root: string; url: URL } {
  const root = mkdtempSync(join(tmpdir(), "softure-db-export-"));
  roots.push(root);
  cpSync(fileURLToPath(getFixtureMigrationsUrl("notes")), join(root, "notes"), { recursive: true });
  return { root, url: pathToFileURL(`${root}/`) };
}

function readNotesChecksum(root: string, fileName: string): string {
  return computeChecksum(readFileSync(join(root, "notes", fileName), "utf8"));
}

const LEDGER_ROW: JournalRow = { module: "softure", version: 1, name: "ledger", checksum: LEDGER_FILES[0]?.checksum ?? "", method: "applied" };

function notesRow(root: string, version: 1 | 2): JournalRow {
  const fileName = version === 1 ? "0001_create_notes.sql" : "0002_add_notes_title_index.sql";
  const name = version === 1 ? "create_notes" : "add_notes_title_index";
  return { module: "notes", version, name, checksum: readNotesChecksum(root, fileName), method: "applied" };
}

function describeFailure<T>(result: MigrationResult<T>): string[] {
  if (result.ok) throw new Error("expected a failure");
  return result.problems.map(describeProblem);
}

describe("checkExportedMigrations", () => {
  it("lists every file as pending on a database without a ledger", async () => {
    const { url } = createExport();
    const result = await checkExportedMigrations(url, []);
    expect(result).toEqual({
      ok: true,
      value: {
        pending: [
          { module: "softure", version: 1, name: "ledger", checksum: LEDGER_ROW.checksum },
          { module: "notes", version: 1, name: "create_notes", checksum: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown },
          { module: "notes", version: 2, name: "add_notes_title_index", checksum: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown },
        ],
        absent: [],
      },
    });
  });

  it("passes with nothing pending when the database applied every file", async () => {
    const { root, url } = createExport();
    const result = await checkExportedMigrations(url, [LEDGER_ROW, notesRow(root, 1), notesRow(root, 2)]);
    expect(result).toEqual({ ok: true, value: { pending: [], absent: [] } });
  });

  it("lists ledger modules the image does not hold as absent, not as a problem", async () => {
    const { root, url } = createExport();
    const billing: JournalRow = { module: "billing", version: 1, name: "init", checksum: "0".repeat(64), method: "applied" };
    const result = await checkExportedMigrations(url, [LEDGER_ROW, billing, notesRow(root, 1), notesRow(root, 2)]);
    expect(result).toEqual({ ok: true, value: { pending: [], absent: ["billing"] } });
  });

  it("refuses an applied file the image changed", async () => {
    const { root, url } = createExport();
    const applied = [LEDGER_ROW, notesRow(root, 1)];
    writeFileSync(join(root, "notes", "0001_create_notes.sql"), "-- Rollback: DROP TABLE notes;\nCREATE TABLE notes (id int);\n");
    expect(describeFailure(await checkExportedMigrations(url, applied))).toEqual([
      "notes: applied migration 0001_create_notes.sql was edited (checksum differs); add a new migration instead",
    ]);
  });

  it("refuses an image that lacks a file the database applied (an older image)", async () => {
    const { root, url } = createExport();
    const newer: JournalRow = { module: "notes", version: 3, name: "add_body", checksum: "a".repeat(64), method: "applied" };
    expect(describeFailure(await checkExportedMigrations(url, [LEDGER_ROW, notesRow(root, 1), notesRow(root, 2), newer]))).toEqual([
      "notes: applied migration 0003_add_body.sql is missing from the module",
    ]);
  });

  it("refuses an image whose ledger migration the database does not know (an older @softure-ai/db)", async () => {
    const { root, url } = createExport();
    const ledgerTwo: JournalRow = { module: "softure", version: 2, name: "ledger_index", checksum: "b".repeat(64), method: "applied" };
    expect(describeFailure(await checkExportedMigrations(url, [LEDGER_ROW, ledgerTwo, notesRow(root, 1), notesRow(root, 2)]))).toEqual([
      "softure: applied migration 0002_ledger_index.sql is missing from the module",
    ]);
  });

  it("refuses a new file numbered below an applied one", async () => {
    const { root, url } = createExport();
    // The database applied 0002 under a ledger row while 0001 never ran: 0001 is pending out of order.
    expect(describeFailure(await checkExportedMigrations(url, [LEDGER_ROW, notesRow(root, 2)]))).toEqual([
      "notes: migration 0001 is pending but 0002 is already applied",
    ]);
  });

  it("refuses an invalid folder: a bad file name and a folder named after the ledger", async () => {
    const { root, url } = createExport();
    writeFileSync(join(root, "notes", "3_bad.sql"), "-- Rollback: none\nSELECT 1;\n");
    mkdirSync(join(root, "softure"));
    const problems = describeFailure(await checkExportedMigrations(url, []));
    expect(problems).toEqual([
      "notes: migration file 3_bad.sql is invalid: the name must look like 0001_create_table.sql (four digits, then lower_snake_case)",
      expect.stringMatching(/^softure: uses a reserved id or schema/) as unknown,
    ]);
  });

  it("refuses a folder that does not exist", async () => {
    const missing = pathToFileURL(join(tmpdir(), "softure-db-export-missing-folder/"));
    expect(describeFailure(await checkExportedMigrations(missing, []))).toEqual([
      `(export): cannot read the migrations folder ${fileURLToPath(missing)}: the folder does not exist`,
    ]);
  });
});

describe.each(createTestDrivers())("readJournal with checkExportedMigrations on $name", (driver) => {
  afterEach(() => driver.cleanup());

  it("passes the folder the database was migrated from", async () => {
    const handle = await driver.open();
    const { url } = createExport();
    expect((await migrate(handle, { modules: [createNotesModule()] })).ok).toBe(true);
    const journal = await withSession(handle, readJournal);
    expect(journal.map((row) => `${row.module} ${row.version}`)).toEqual(["softure 1", "notes 1", "notes 2"]);
    expect(await checkExportedMigrations(url, journal)).toEqual({ ok: true, value: { pending: [], absent: [] } });
  });
});
