// The migration ledger `softure.migrations` (docs/02-module-standard.md §4). It is owned by the
// pseudo-module `softure` and created by its own migration, which ships as code so a bundled
// runner needs no file for it. While the table does not exist the journal reads as empty, so the
// first run bootstraps through the normal path.
//
// NEVER edit LEDGER_MIGRATION: deployed databases hold its checksum (a test pins it). A change to
// the ledger is a new file, `0002_…`, appended to LEDGER_FILES.
import { createMigrationFile, type MigrationFile } from "./files.js";
import type { MigrationSession } from "./session.js";

export const LEDGER_MODULE_ID = "softure";
export const LEDGER_SCHEMA = "softure";
/** The ledger's own format version, recorded as `module_version` of its rows. */
export const LEDGER_VERSION = "1.0.0";

const LEDGER_MIGRATION = `-- Rollback: DROP SCHEMA softure CASCADE; this forgets which module migrations ran, the module schemas and their data stay.
CREATE TABLE softure.migrations (
  id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  module text NOT NULL CHECK (module ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL CHECK (name ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  module_version text NOT NULL,
  method text NOT NULL CHECK (method IN ('applied', 'adopted')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module, version)
);
`;

function createLedgerFiles(): MigrationFile[] {
  const file = createMigrationFile("0001_ledger.sql", LEDGER_MIGRATION);
  if (typeof file === "string") {
    throw new Error(`ledger: the built-in migration is invalid: ${file}`);
  }
  return [file];
}

export const LEDGER_FILES: readonly MigrationFile[] = createLedgerFiles();

export type MigrationMethod = "applied" | "adopted";

export interface JournalRow {
  readonly module: string;
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly method: MigrationMethod;
}

export interface LedgerEntry {
  readonly module: string;
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly moduleVersion: string;
  readonly method: MigrationMethod;
}

/** Every ledger row, or none while the ledger table does not exist yet. */
export async function readJournal(session: MigrationSession): Promise<JournalRow[]> {
  const [table] = await session.query<{ exists: boolean }>("SELECT to_regclass('softure.migrations') IS NOT NULL AS exists");
  if (table?.exists !== true) {
    return [];
  }
  return session.query<JournalRow>(
    "SELECT module, version, name, checksum, method FROM softure.migrations ORDER BY id",
  );
}

export async function recordMigration(session: MigrationSession, entry: LedgerEntry): Promise<void> {
  await session.query(
    "INSERT INTO softure.migrations (module, version, name, checksum, module_version, method) VALUES ($1, $2, $3, $4, $5, $6)",
    [entry.module, entry.version, entry.name, entry.checksum, entry.moduleVersion, entry.method],
  );
}
