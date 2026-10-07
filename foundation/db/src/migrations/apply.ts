// The primitives every migration path shares (migrate, adoption, the reference schema): one file in
// one transaction with its ledger row, adoption rows in one transaction, the advisory lock.
import type { MigrationFile } from "./files.js";
import { recordMigration, type MigrationMethod } from "./ledger.js";
import type { MigrationProblem } from "./problems.js";
import type { MigrationSession } from "./session.js";

/** One migration owner: the ledger itself or an enabled module with a schema. */
export interface MigrationUnit {
  readonly module: string;
  readonly schema: string;
  readonly moduleVersion: string;
  readonly files: readonly MigrationFile[];
}

// Any constant works; it only has to be the same for every runner of every app.
const MIGRATION_LOCK_KEY = "73012026";

/**
 * Runs one file and its ledger row in one transaction, inside the unit's schema. Returns the
 * problem when the SQL fails; the transaction is rolled back first.
 */
export async function applyFile(
  session: MigrationSession,
  input: { unit: MigrationUnit; file: MigrationFile; method: MigrationMethod },
): Promise<MigrationProblem | null> {
  const { unit, file, method } = input;
  // The schema passed the manifest's lower_snake_case rule and checkModule; quoting is a second line.
  const schema = quoteIdentifier(unit.schema);
  try {
    await session.exec(`BEGIN; CREATE SCHEMA IF NOT EXISTS ${schema}; SET LOCAL search_path TO ${schema}, public;`);
    const transactionId = await readTransactionId(session);
    if (method === "applied") {
      await session.exec(file.sql);
    }
    // Second line behind findTransactionControl: a file that still ended the transaction left
    // part of itself committed, so it must not be reported as cleanly rolled back.
    if ((await readTransactionId(session)) !== transactionId) {
      throw new TransactionEndedError();
    }
    await recordMigration(session, {
      module: unit.module,
      version: file.version,
      name: file.name,
      checksum: file.checksum,
      moduleVersion: unit.moduleVersion,
      method,
    });
    await session.exec("COMMIT");
    return null;
  } catch (error) {
    const reason = await rollBack(session, error);
    return { code: "db.migration_failed", module: unit.module, version: file.version, name: file.name, reason };
  }
}

class TransactionEndedError extends Error {
  constructor() {
    super("the file ended the migrator's transaction, so the statements before that point may be committed; check the schema by hand");
  }
}

// The transaction id, not now(): two transactions can share a start time (PGlite's clock ticks in
// milliseconds), but never an id.
async function readTransactionId(session: MigrationSession): Promise<string> {
  const [row] = await session.query<{ id: string }>("SELECT pg_current_xact_id()::text AS id");
  return row?.id ?? "";
}

/**
 * Rolls the open transaction back and returns the reason to report. A failing ROLLBACK (a lost
 * connection) is added to the reason instead of hiding the original error.
 */
export async function rollBack(session: MigrationSession, error: unknown): Promise<string> {
  const reason = describeError(error);
  try {
    await session.exec("ROLLBACK");
    return reason;
  } catch (rollbackError) {
    return `${reason} (and ROLLBACK failed: ${describeError(rollbackError)})`;
  }
}

/** Holds the session-level advisory lock while `run` runs; a second runner waits for it. */
export async function withMigrationLock<T>(session: MigrationSession, run: () => Promise<T>): Promise<T> {
  await session.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  let result: T;
  try {
    result = await run();
  } catch (error) {
    // The run's own error wins; an unlock failure here is secondary (the session is discarded).
    await session.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch((unlockError: unknown) => {
      throw new Error(`migration run failed (${describeError(error)}) and releasing the lock failed: ${describeError(unlockError)}`, {
        cause: error,
      });
    });
    throw error;
  }
  await session.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  return result;
}

/**
 * Records `files` of the unit as adopted, all in one transaction: either every row is written or
 * none. Returns the problem when a write fails.
 */
export async function recordAdoption(session: MigrationSession, unit: MigrationUnit, files: readonly MigrationFile[]): Promise<MigrationProblem | null> {
  try {
    await session.exec("BEGIN");
    for (const file of files) {
      await recordMigration(session, {
        module: unit.module,
        version: file.version,
        name: file.name,
        checksum: file.checksum,
        moduleVersion: unit.moduleVersion,
        method: "adopted",
      });
    }
    await session.exec("COMMIT");
    return null;
  } catch (error) {
    const reason = await rollBack(session, error);
    const first = files[0];
    return { code: "db.migration_failed", module: unit.module, version: first?.version ?? 0, name: first?.name ?? "", reason };
  }
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
