// Drizzle view of the module's tables (migrations/0001_create_entitlements.sql,
// 0002_create_payments.sql, 0003_record_payment_grants.sql, 0004_create_requests_and_grants.sql,
// 0005_record_refunded_amounts.sql, 0006_record_request_handover_and_prices.sql,
// 0007_record_failed_refunds.sql and 0008_record_request_handover_claims.sql).
// The migrations are the source of truth; this file only types the queries.
import { bigint, boolean, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  grantKind: text("grant_kind", { enum: ["period", "lifetime"] }),
  grantedFrom: timestamp("granted_from", { withTimezone: true }),
  grantedUntil: timestamp("granted_until", { withTimezone: true }),
  refundedAmount: bigint("refunded_amount", { mode: "number" }).notNull().default(0),
  takenBackDays: integer("taken_back_days").notNull().default(0),
  refundsSeenAt: timestamp("refunds_seen_at", { withTimezone: true }),
});

export const refundFailures = billingSchema.table(
  "refund_failures",
  {
    paymentId: uuid("payment_id").notNull(),
    refundId: text("refund_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    refundCreatedAt: timestamp("refund_created_at", { withTimezone: true }).notNull(),
    failedAt: timestamp("failed_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.paymentId, table.refundId] })],
);

export const paymentRequests = billingSchema.table("payment_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  planId: text("plan_id").notNull(),
  invoiceName: text("invoice_name"),
  invoiceTaxId: text("invoice_tax_id"),
  invoiceAddress: text("invoice_address"),
  status: text("status", { enum: ["open", "granted", "dismissed", "expired"] }).notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
  handoverClaimedAt: timestamp("handover_claimed_at", { withTimezone: true }),
  amount: bigint("amount", { mode: "number" }),
  currency: text("currency"),
});

export const manualGrants = billingSchema.table("manual_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  planId: text("plan_id").notNull(),
  requestId: uuid("request_id"),
  grantedBy: uuid("granted_by"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  grantKind: text("grant_kind", { enum: ["period", "lifetime"] }).notNull(),
  grantedFrom: timestamp("granted_from", { withTimezone: true }),
  grantedUntil: timestamp("granted_until", { withTimezone: true }),
  status: text("status", { enum: ["active", "revoked"] }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by"),
  amount: bigint("amount", { mode: "number" }),
  currency: text("currency"),
});
