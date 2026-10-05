// The deploy-time check of an exported migrations folder (the new image's, written by
// `softure migrate --export-migrations`) against a database's ledger, without the app config. It runs
// the migrator's own comparison, so a deploy never accepts what `softure migrate` would refuse.
import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ok } from "@softure-ai/core";
import { readMigrationFiles } from "./files.js";
import { LEDGER_FILES, LEDGER_MODULE_ID, LEDGER_SCHEMA, LEDGER_VERSION, type JournalRow } from "./ledger.js";
import { compareJournal, type MigrationUnit } from "./migrator.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";

export interface ExportedMigration {
  readonly module: string;
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export interface ExportedMigrationsCheck {
  /** Files the database has not applied yet, per module in folder order; `softure migrate` applies them. */
  readonly pending: readonly ExportedMigration[];
  /** Modules the ledger knows but the folder does not hold: not enabled in the image, so the migrator ignores them. */
  readonly absent: readonly string[];
}

/**
 * Compares `<migrationsDir>/<module id>/*.sql` and the built-in ledger migration with the journal. Fails with every
 * problem: an applied file edited or missing, a pending file numbered below an applied one, an invalid folder.
 */
export async function checkExportedMigrations(
  migrationsDir: URL,
  journal: readonly JournalRow[],
): Promise<MigrationResult<ExportedMigrationsCheck>> {
  const folders = await listModuleFolders(migrationsDir);
  if (!folders.ok) {
    return folders;
  }
  const problems: MigrationProblem[] = [];
  const units: MigrationUnit[] = [
    { module: LEDGER_MODULE_ID, schema: LEDGER_SCHEMA, moduleVersion: LEDGER_VERSION, files: LEDGER_FILES },
  ];
  for (const module of folders.value) {
    if (module === LEDGER_MODULE_ID) {
      problems.push({ code: "db.reserved_module", module });
      continue;
    }
    const files = await readMigrationFiles(module, new URL(`${encodeURIComponent(module)}/`, ensureFolderUrl(migrationsDir)));
    if (files.ok) {
      // The schema is not part of the export; the comparison does not read it.
      units.push({ module, schema: "", moduleVersion: "", files: files.value });
    } else {
      problems.push(...files.problems);
    }
  }
  const comparison = compareJournal(units, journal);
  problems.push(...comparison.problems);
  if (problems.length > 0) {
    return failWith(problems);
  }
  const known = new Set(units.map((unit) => unit.module));
  const absent = [...new Set(journal.map((row) => row.module))].filter((module) => !known.has(module)).sort();
  const pending = comparison.pending.map(({ module, version, name, checksum }) => ({ module, version, name, checksum }));
  return ok({ pending, absent });
}

/** The module folders, sorted; files beside them (a README) are ignored. */
async function listModuleFolders(dir: URL): Promise<MigrationResult<string[]>> {
  let entries: Dirent[];
  try {
    entries = await readdir(fileURLToPath(dir), { withFileTypes: true });
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown error";
    const reason = code === "ENOENT" ? "the folder does not exist" : code;
    return failWith([{ code: "db.migrations_unreadable", module: "(export)", dir: fileURLToPath(dir), reason }]);
  }
  return ok(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort());
}

function ensureFolderUrl(url: URL): URL {
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}
