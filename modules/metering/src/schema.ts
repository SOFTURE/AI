// Drizzle view of the module's tables (migrations/0001_create_charges.sql, 0003_create_budget_limits.sql). The
// migrations are the source of truth; this file only types the queries.
import { boolean, jsonb, numeric, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export const budgetLimits = meteringSchema.table(
  "budget_limits",
  {
    provider: text("provider").notNull(),
    period: text("period").$type<"day" | "month">().notNull(),
    perAccount: boolean("per_account").notNull(),
    /** `numeric(24, 8)`, read as text so no precision is lost on the way. */
    limit: numeric("limit", { precision: 24, scale: 8 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.period, table.perAccount] })],
);
