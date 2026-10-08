// The schema guard: the new image's exported migrations against the database's `@softure-ai/db` ledger, with the
// migrator's own rules (`checkExportedMigrations`), and the app's own drizzle migrations against its ledger
// (`compareAppLedger`). Read only: it takes no lock and writes nothing.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkExportedMigrations, describeProblem, readJournal, type ExportedMigrationsCheck, type JournalRow } from "@softure-ai/db";
import type pg from "pg";
import { compareAppLedger, readAppJournal, readAppLedger, type AppLedgerCheck, type AppLedgerRow } from "./app-ledger.js";

export interface SchemaGuardCheck {
  /** null when the image's softure export was not checked (`--migrations-dir` not given). */
  readonly softure: ExportedMigrationsCheck | null;
  /** null when the app's own migrations were not checked (`--app-migrations-dir` not given). */
  readonly app: AppLedgerCheck | null;
}

export type SchemaGuardResult = { ok: true; check: SchemaGuardCheck } | { ok: false; problems: string[] };

export interface SchemaGuardInput {
  /** The folder of `softure migrate --export-migrations`, or null. */
  readonly migrationsDir: string | null;
  readonly journal: readonly JournalRow[];
  /** The app's drizzle folder (with `meta/_journal.json`), or null. */
  readonly appMigrationsDir: string | null;
  readonly appRows: readonly AppLedgerRow[];
}

/** Both checks on ledger rows already read (over a connection or from psql's output); every problem is listed. */
export async function checkSchema(input: SchemaGuardInput): Promise<SchemaGuardResult> {
  const problems: string[] = [];
  let softure: ExportedMigrationsCheck | null = null;
  if (input.migrationsDir !== null) {
    const result = await checkExportedMigrations(pathToFileURL(`${resolve(input.migrationsDir)}/`), input.journal);
    if (result.ok) softure = result.value;
    else problems.push(...result.problems.map(describeProblem));
  }
  let app: AppLedgerCheck | null = null;
  if (input.appMigrationsDir !== null) {
    const journal = readAppJournal(input.appMigrationsDir);
    if (!journal.ok) {
      problems.push(journal.problem);
    } else {
      const result = compareAppLedger(journal.entries, input.appRows);
      if (result.ok) app = result.check;
      else problems.push(...result.problems);
    }
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, check: { softure, app } };
}

export interface GuardSchemaOptions {
  readonly migrationsDir: string | null;
  readonly appMigrationsDir: string | null;
  /** `schema.table` of the app's drizzle ledger. */
  readonly appLedger: string;
}

/** Reads the ledgers over `client`, then `checkSchema`. */
export async function guardSchema(client: pg.Client, options: GuardSchemaOptions): Promise<SchemaGuardResult> {
  const journal =
    options.migrationsDir === null
      ? []
      : await readJournal({
          query: async <T>(text: string, params?: readonly unknown[]) => (await client.query(text, params ? [...params] : undefined)).rows as T[],
          exec: async (sql) => {
            await client.query(sql);
          },
        });
  const appRows = options.appMigrationsDir === null ? [] : await readAppLedger(client, options.appLedger);
  return checkSchema({ migrationsDir: options.migrationsDir, journal, appMigrationsDir: options.appMigrationsDir, appRows });
}
