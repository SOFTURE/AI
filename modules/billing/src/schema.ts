// Drizzle view of the module's table (migrations/0001_create_entitlements.sql). The migration is the
// source of truth; this file only types the queries.
import { boolean, pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

export const billingSchema = pgSchema("billing");

export const entitlements = billingSchema.table("entitlements", {
  userId: uuid("user_id").primaryKey(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
  paidUntil: timestamp("paid_until", { withTimezone: true }),
  isLifetime: boolean("is_lifetime").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
