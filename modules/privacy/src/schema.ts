// Drizzle view of the module's table (migrations/0001_create_consents.sql). The migration is the
// source of truth; this file only types the queries.
import { users } from "@softure-ai/auth";
import { bigint, boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const privacySchema = pgSchema("privacy");

export const consents = privacySchema.table("consents", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  emailKey: text("email_key"),
  purpose: text("purpose").notNull(),
  granted: boolean("granted").notNull(),
  documentId: text("document_id"),
  documentVersion: text("document_version"),
  source: text("source").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
});
