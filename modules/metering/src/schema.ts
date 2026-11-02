// Drizzle view of the module's table (migrations/0001_create_charges.sql). The migration is the source of truth;
// this file only types the queries.
import { jsonb, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const meteringSchema = pgSchema("metering");

export const charges = meteringSchema.table("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  step: text("step"),
  unit: text("unit").notNull(),
  /** `numeric(24, 8)`, read as text so no precision is lost on the way. */
  amount: numeric("amount", { precision: 24, scale: 8 }).notNull(),
  accountId: text("account_id"),
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull(),
  status: text("status").$type<"reserved" | "settled">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});
