// Drizzle view of the module's tables (migrations/0001_create_rate_limits.sql, 0002_create_webhook_deliveries.sql).
// The migrations are the source of truth; this file only types the queries.
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

export const webhookDeliveries = securitySchema.table(
  "webhook_deliveries",
  {
    source: text("source").notNull(),
    deliveryId: text("delivery_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.source, table.deliveryId] })],
);
