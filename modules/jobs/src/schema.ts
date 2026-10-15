// Drizzle view of the module's tables (migrations/). The migrations are the source of truth; this
// file only types the queries.
import { bigint, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const jobsSchema = pgSchema("jobs");

export const jobs = jobsSchema.table("jobs", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  queue: text("queue").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["pending", "running", "succeeded", "failed", "cancelled"] }).notNull(),
  attempts: integer("attempts").notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lockedBy: text("locked_by"),
  claimToken: uuid("claim_token"),
  dedupKey: text("dedup_key"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type JobRow = typeof jobs.$inferSelect;

export const schedules = jobsSchema.table("schedules", {
  name: text("name").primaryKey(),
  lastSlotAt: timestamp("last_slot_at", { withTimezone: true }).notNull(),
  lastSucceededAt: timestamp("last_succeeded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
