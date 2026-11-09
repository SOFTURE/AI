// Drizzle view of the module's table (migrations/0001_create_runs.sql). The migration is the source of truth; this
// file only types the queries.
import { bigint, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import type { BackupObject, BackupResult } from "./contract.js";

export const backupSchema = pgSchema("backup");

export const runs = backupSchema.table("runs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  result: text("result").$type<BackupResult>().notNull(),
  objects: jsonb("objects").$type<BackupObject[]>().notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
});
