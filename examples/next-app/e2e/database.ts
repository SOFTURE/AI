// Direct database access for test setup and cleanup, through the same package the app uses.
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import config from "../softure.config.ts";
import { entries } from "../modules/guestbook/schema.ts";

export async function openTestDatabase(): Promise<DatabaseHandle> {
  if (config.database === null) throw new Error("openTestDatabase: softure.config.ts has no database");
  return createDatabase(config.database.url, { max: 1 });
}

export async function deleteEntries(handle: DatabaseHandle, message: string): Promise<void> {
  await handle.db.delete(entries).where(eq(entries.message, message));
}
