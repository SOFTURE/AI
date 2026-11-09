// Verify the newest off-site copy end to end: it is recent enough, it decrypts, pg_restore takes it whole into a
// throwaway database, the deploy's schema guard accepts it against the app's migrations, and every table of
// deploy.json's rowCountTables (less excludeTableData, whose rows the dump leaves out) is there; then the database is
// dropped, also after a failure. It needs the private key, so it runs on the operator's machine or in a CI job,
// never on the server.
import { countRows, guardSchema, withPgClient, type RowCounts } from "@softure-ai/deploy";
import type { StoreConfig } from "./config.js";
import { decryptStream } from "./crypto.js";
import { createDatabase, createVerifyDatabaseName, dropDatabase, runPgRestore, withDatabase } from "./postgres.js";
import { resolveKey, type OffsiteResult } from "./restore.js";
import { getObjectStream, type S3Options } from "./s3.js";

export const DEFAULT_MAX_AGE_HOURS = 26;
const HOUR_MS = 60 * 60 * 1000;

export interface VerifyOptions {
  readonly store: StoreConfig;
  readonly identities: readonly string[];
  /** A superuser's URL on a scratch server (or the operator's own); a throwaway database is created there. */
  readonly adminUrl: string;
  /** Tables that must exist in the restored copy. */
  readonly tables: readonly string[];
  /** The app's exported migrations (the image's softure-migrations folder): the schema guard runs when set. */
  readonly migrationsDir?: string;
  readonly maxAgeHours?: number;
  readonly pgRestore: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly now?: Date;
  readonly s3?: S3Options;
  /** A fixed name instead of a random one (tests). */
  readonly database?: string;
}

export interface VerifyOutcome {
  readonly key: string;
  readonly ageHours: number;
  readonly counts: RowCounts;
  readonly schemaGuard: "passed" | "skipped";
}

/** The tables to check: rowCountTables less excludeTableData. */
export function selectVerifyTables(rowCountTables: readonly string[] | undefined, excludeTableData: readonly string[] | undefined): string[] {
  const excluded = new Set(excludeTableData ?? []);
  return (rowCountTables ?? []).filter((table) => !excluded.has(table));
}

async function checkRestored(url: string, options: VerifyOptions): Promise<OffsiteResult<{ counts: RowCounts; schemaGuard: "passed" | "skipped" }>> {
  return withPgClient(url, async (client) => {
    let schemaGuard: "passed" | "skipped" = "skipped";
    if (options.migrationsDir !== undefined) {
      const guard = await guardSchema(client, options.migrationsDir);
      if (!guard.ok) return { ok: false, problem: `the schema guard refused the restored copy: ${guard.problems.join("; ")}` };
      schemaGuard = "passed";
    }
    const counts = await countRows(client, options.tables);
    const missing = Object.entries(counts).filter(([, count]) => count === null).map(([table]) => table);
    if (missing.length > 0) return { ok: false, problem: `the restored copy lacks ${missing.join(", ")}` };
    return { ok: true, value: { counts, schemaGuard } };
  });
}

export async function verifyBackup(options: VerifyOptions): Promise<OffsiteResult<VerifyOutcome>> {
  const now = options.now ?? new Date();
  const resolved = await resolveKey(options.store, "database", undefined, options.s3);
  if (!resolved.ok) return resolved;
  const ageHours = (now.getTime() - resolved.value.takenAt.getTime()) / HOUR_MS;
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  if (ageHours > maxAgeHours) {
    return { ok: false, problem: `the newest off-site copy ${resolved.value.key} is ${ageHours.toFixed(1)} h old, more than ${String(maxAgeHours)} h` };
  }
  const encrypted = await getObjectStream(options.store, resolved.value.key, options.s3);
  let dump: ReadableStream<Uint8Array>;
  try {
    dump = await decryptStream(encrypted, options.identities);
  } catch (error) {
    await encrypted.cancel().catch(() => undefined);
    return { ok: false, problem: `cannot decrypt ${resolved.value.key} with this identity (${error instanceof Error ? error.message : String(error)})` };
  }
  const database = options.database ?? createVerifyDatabaseName();
  await createDatabase(options.adminUrl, database);
  try {
    const restored = await runPgRestore({
      adminUrl: options.adminUrl,
      database,
      flags: ["--no-owner", "--no-acl"],
      dump,
      pgRestore: options.pgRestore,
      env: options.env,
    });
    if (!restored.ok) return { ok: false, problem: `${resolved.value.key} does not restore: ${restored.problem}` };
    const checked = await checkRestored(withDatabase(options.adminUrl, database), options);
    if (!checked.ok) return checked;
    return { ok: true, value: { key: resolved.value.key, ageHours, ...checked.value } };
  } finally {
    await dropDatabase(options.adminUrl, database);
  }
}
