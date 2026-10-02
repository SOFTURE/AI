// Reads and writes of the guestbook. Failures come back as `core.*` codes (safeError), never as SQL.
import { errorLogLabel, ok, safeError, type CoreErrorCode, type Err, type Result } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, desc } from "drizzle-orm";
import { entries, migrationLedger } from "./schema.ts";

export interface GuestbookEntry {
  readonly id: number;
  readonly message: string;
}

export interface AppliedMigration {
  readonly module: string;
  readonly version: number;
  readonly name: string;
  readonly method: string;
}

const LISTED_ENTRIES = 20;

export async function findEntries(db: Queryable): Promise<Result<GuestbookEntry[]>> {
  try {
    const rows = await db
      .select({ id: entries.id, message: entries.message })
      .from(entries)
      .orderBy(desc(entries.id))
      .limit(LISTED_ENTRIES);
    return ok(rows);
  } catch (error) {
    return fail("listing entries", error);
  }
}

export async function insertEntry(db: Queryable, message: string): Promise<Result<undefined>> {
  try {
    await db.insert(entries).values({ message });
    return ok();
  } catch (error) {
    return fail("adding an entry", error);
  }
}

export async function findAppliedMigrations(db: Queryable): Promise<Result<AppliedMigration[]>> {
  try {
    const rows = await db
      .select()
      .from(migrationLedger)
      .orderBy(asc(migrationLedger.module), asc(migrationLedger.version));
    return ok(rows);
  } catch (error) {
    return fail("listing applied migrations", error);
  }
}

function fail(operation: string, error: unknown): Err<CoreErrorCode> {
  console.error(`guestbook: ${operation} failed: ${errorLogLabel(error)}`);
  return safeError(error);
}
