// The schema guard: the new image's exported migrations against the database's `@softure-ai/db` ledger, with the
// migrator's own rules (`checkExportedMigrations`), and, for an app with its own migrator (drizzle), the image's
// journal against the app ledger: an image that knows fewer migrations than the database ran is old code on a newer
// schema. Read only: it takes no lock and writes nothing. The ledgers come from one snapshot statement
// (`buildLedgerQuery`), run here through `pg` or by `psql` elsewhere and piped in.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkExportedMigrations, describeProblem, type ExportedMigrationsCheck } from "@softure-ai/db";
import type pg from "pg";
import { z } from "zod";
import { buildLedgerQuery, parseLedgerSnapshot, type LedgerSnapshot, type SnapshotResult } from "./snapshot-query.js";

/** The image's journal against the app ledger: entries the image ships, rows the database recorded. */
export interface AppLedgerCheck {
  readonly ledger: string;
  readonly imageEntries: number;
  readonly databaseRows: number;
}

export type SchemaGuardResult =
  | { ok: true; check: ExportedMigrationsCheck; app: AppLedgerCheck | null }
  | { ok: false; problems: string[] };

/** The app's migration journal in the image (drizzle's `meta/_journal.json`) and the ledger table it fills. */
export interface AppJournal {
  readonly ledger: string;
  readonly entries: number;
}

const journalFileSchema = z.looseObject({ entries: z.array(z.unknown()) });

/** The number of entries of a drizzle-style journal file (`{ "entries": [...] }`). */
export function readAppJournal(path: string, ledger: string): SnapshotResult<AppJournal> {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof SyntaxError ? "not JSON" : ((error as NodeJS.ErrnoException).code ?? "unknown error");
    return { ok: false, problem: `cannot read the app journal ${path} (${reason})` };
  }
  const parsed = journalFileSchema.safeParse(json);
  if (!parsed.success) return { ok: false, problem: `the app journal ${path} has no entries list` };
  return { ok: true, value: { ledger, entries: parsed.data.entries.length } };
}

/** Both checks over one snapshot; `appJournal` null skips the app ledger. */
export async function guardLedgers(options: {
  snapshot: LedgerSnapshot;
  migrationsDir: string;
  appJournal: AppJournal | null;
}): Promise<SchemaGuardResult> {
  const { snapshot, appJournal } = options;
  const problems: string[] = [];
  let app: AppLedgerCheck | null = null;
  if (appJournal !== null) {
    if (snapshot.app?.ledger !== appJournal.ledger) {
      problems.push(`the snapshot holds no rows of ${appJournal.ledger}; print the query with --app-ledger=${appJournal.ledger}`);
    } else {
      // A ledger table that does not exist yet: nothing ran, so any image can take the database.
      app = { ledger: appJournal.ledger, imageEntries: appJournal.entries, databaseRows: snapshot.app.rows ?? 0 };
      if (app.imageEntries < app.databaseRows) {
        problems.push(
          `${app.ledger}: the image knows ${app.imageEntries} migration(s), the database ran ${app.databaseRows}; this is an older image than the schema`,
        );
      }
    }
  }
  const result = await checkExportedMigrations(pathToFileURL(`${resolve(options.migrationsDir)}/`), snapshot.softure);
  if (!result.ok) problems.push(...result.problems.map(describeProblem));
  if (problems.length > 0 || !result.ok) return { ok: false, problems };
  return { ok: true, check: result.value, app };
}

/** Reads the snapshot through `client` (the statement `--print-query` prints). */
export async function readLedgerSnapshot(client: pg.Client, appLedger: string | null): Promise<SnapshotResult<LedgerSnapshot>> {
  const result = await client.query<{ snapshot: string }>(buildLedgerQuery({ appLedger }));
  return parseLedgerSnapshot(result.rows[0]?.snapshot ?? "");
}

/** The module ledger only, through a connection: the 0.1.4 entry point, kept for library callers. */
export async function guardSchema(client: pg.Client, migrationsDir: string): Promise<SchemaGuardResult> {
  const snapshot = await readLedgerSnapshot(client, null);
  if (!snapshot.ok) return { ok: false, problems: [snapshot.problem] };
  return guardLedgers({ snapshot: snapshot.value, migrationsDir, appJournal: null });
}
