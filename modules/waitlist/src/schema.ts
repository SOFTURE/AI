// Drizzle view of the module's table (migrations/0001_create_signups.sql). The migration is the
// source of truth; this file only types the queries.
import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const waitlistSchema = pgSchema("waitlist");

export const signups = waitlistSchema.table("signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique("signups_email_key"),
  scopes: text("scopes").array().notNull(),
  placement: text("placement").notNull(),
  locale: text("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
