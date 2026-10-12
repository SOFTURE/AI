// A query helper between an entry and the client.
import { sql } from "drizzle-orm";
import { db } from "./client.js";

export async function countNotes(): Promise<unknown> {
  return db.execute(sql`select 1`);
}
