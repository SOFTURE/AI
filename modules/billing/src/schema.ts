// Drizzle view of the module's tables (migrations/0001_create_entitlements.sql and
// 0002_create_payments.sql). The migrations are the source of truth; this file only types the queries.
import { bigint, boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const billingSchema = pgSchema("billing");

export const entitlements = billingSchema.table("entitlements", {
  userId: uuid("user_id").primaryKey(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
  paidUntil: timestamp("paid_until", { withTimezone: true }),
  isLifetime: boolean("is_lifetime").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const payments = billingSchema.table("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  checkoutId: text("checkout_id").notNull(),
  paymentId: text("payment_id"),
  planId: text("plan_id").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  status: text("status", { enum: ["paid", "refunded"] }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});
