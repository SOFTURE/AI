// Drizzle view of the module's table (migrations/0001_create_suppressions.sql). The migration is
// the source of truth; this file only types the queries.
import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const mailingSchema = pgSchema("mailing");

export const suppressions = mailingSchema.table("suppressions", {
  recipientKey: text("recipient_key").primaryKey(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
