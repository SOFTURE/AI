// Drizzle view of the module's table (migrations/0001_create_rate_limits.sql). The migration is the
// source of truth; this file only types the queries.
import { integer, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const securitySchema = pgSchema("security");

export const rateLimits = securitySchema.table(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    identifier: text("identifier").notNull(),
    attempts: integer("attempts").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.identifier] })],
);
