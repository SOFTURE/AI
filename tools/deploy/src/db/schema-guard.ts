// The schema guard: the new image's exported migrations against the database's `@softure-ai/db` ledger, with the
// migrator's own rules (`checkExportedMigrations`). Read only: it takes no lock and writes nothing.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkExportedMigrations, describeProblem, readJournal, type ExportedMigrationsCheck } from "@softure-ai/db";
import type pg from "pg";

export type SchemaGuardResult = { ok: true; check: ExportedMigrationsCheck } | { ok: false; problems: string[] };

export async function guardSchema(client: pg.Client, migrationsDir: string): Promise<SchemaGuardResult> {
  const journal = await readJournal({
    query: async <T>(text: string, params?: readonly unknown[]) => (await client.query(text, params ? [...params] : undefined)).rows as T[],
    exec: async (sql) => {
      await client.query(sql);
    },
  });
  const result = await checkExportedMigrations(pathToFileURL(`${resolve(migrationsDir)}/`), journal);
  return result.ok ? { ok: true, check: result.value } : { ok: false, problems: result.problems.map(describeProblem) };
}
