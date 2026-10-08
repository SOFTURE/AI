// The app's own drizzle ledger against the new image's drizzle journal. drizzle's migrator records each applied
// migration as `(hash, created_at)`, where `created_at` is the journal entry's `when`; it reads only the newest row
// and applies every entry whose `when` is greater. So an image older than the database applies nothing without a
// word, and an entry inserted below the newest applied one never runs: both are refused here, before the switch.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TABLE_NAME_PATTERN, type Queryable } from "./row-counts.js";

/** drizzle-kit's ledger table when `migrationsSchema`/`migrationsTable` are left at their defaults. */
export const DEFAULT_APP_LEDGER = "drizzle.__drizzle_migrations";

/** One row of the app's ledger: the sha256 of the migration file and the journal `when` it was applied for. */
export interface AppLedgerRow {
  readonly hash: string;
  readonly createdAt: number;
}

export interface AppJournalEntry {
  readonly tag: string;
  readonly when: number;
  /** sha256 of `<tag>.sql`, or null when the image has no such file. */
  readonly hash: string | null;
}

const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string().regex(/^[A-Za-z0-9_-]+$/, "a file name without a path"), when: z.number().int() })),
});

export type AppJournalResult = { ok: true; entries: AppJournalEntry[] } | { ok: false; problem: string };

/** `<dir>/meta/_journal.json` and the hash of each entry's SQL file, as drizzle computes it (the whole file text). */
export function readAppJournal(dir: string): AppJournalResult {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8"));
  } catch (error) {
    const reason = error instanceof SyntaxError ? "not valid JSON" : ((error as NodeJS.ErrnoException).code ?? "unknown error");
    return { ok: false, problem: `cannot read meta/_journal.json of the app migrations (${reason})` };
  }
  const parsed = journalSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, problem: `meta/_journal.json of the app migrations is not a drizzle journal: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  }
  const entries = parsed.data.entries.map(({ tag, when }) => ({ tag, when, hash: hashFile(join(dir, `${tag}.sql`)) }));
  return { ok: true, entries };
}

function hashFile(path: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
  } catch {
    return null;
  }
}

export interface AppLedgerCheck {
  /** Entries the migrator will apply, oldest first. */
  readonly pending: AppJournalEntry[];
  /** Applied entries whose file differs from the one that ran; drizzle never reads them again, so this is a note. */
  readonly changed: AppJournalEntry[];
}

export type AppLedgerResult = { ok: true; check: AppLedgerCheck } | { ok: false; problems: string[] };

/** The rows of the ledger against the journal of the new image; refuses what drizzle would get wrong silently. */
export function compareAppLedger(entries: readonly AppJournalEntry[], rows: readonly AppLedgerRow[]): AppLedgerResult {
  const byWhen = new Map(entries.map((entry) => [entry.when, entry]));
  const applied = new Set<number>();
  const problems: string[] = [];
  const changed: AppJournalEntry[] = [];
  for (const row of rows) {
    const entry = byWhen.get(row.createdAt);
    if (entry === undefined) {
      problems.push(`app migration applied at ${row.createdAt} is not in the image's journal: the image is older than the database`);
      continue;
    }
    applied.add(entry.when);
    if (entry.hash !== null && entry.hash !== row.hash) changed.push(entry);
  }
  const newest = rows.reduce((max, row) => Math.max(max, row.createdAt), Number.NEGATIVE_INFINITY);
  const pending: AppJournalEntry[] = [];
  for (const entry of [...entries].sort((a, b) => a.when - b.when)) {
    if (applied.has(entry.when)) continue;
    if (entry.when <= newest) {
      problems.push(`app migration ${entry.tag} is older than the newest applied one and would never run`);
      continue;
    }
    pending.push(entry);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, check: { pending, changed } };
}

/** `drizzle.__drizzle_migrations` → `"drizzle"."__drizzle_migrations"`, after the name passed `TABLE_NAME_PATTERN`. */
export function quoteTableName(table: string): string {
  if (!TABLE_NAME_PATTERN.test(table)) throw new Error(`quoteTableName: not a table name: ${table}`);
  return table.split(".").map((part) => `"${part}"`).join(".");
}

/** The ledger's rows, none while the table does not exist (a database the app has not migrated yet). */
export async function readAppLedger(client: Queryable, table: string): Promise<AppLedgerRow[]> {
  const quoted = quoteTableName(table);
  const found = await client.query<{ present: boolean }>("SELECT to_regclass($1) IS NOT NULL AS present", [quoted]);
  if (found.rows[0]?.present !== true) return [];
  // bigint arrives as a string; journal `when` values are milliseconds, far below 2^53.
  const result = await client.query<{ hash: string; created_at: string }>(`SELECT hash, created_at::text AS created_at FROM ${quoted} ORDER BY created_at`);
  return result.rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }));
}
