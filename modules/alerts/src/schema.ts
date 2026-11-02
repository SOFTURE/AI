// Drizzle view of the module's table (migrations/). The migrations are the source of truth; this file only types the
// queries.
import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const alertsSchema = pgSchema("alerts");

export const alerts = alertsSchema.table("alerts", {
  key: text("key").primaryKey(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  title: text("title").notNull(),
  details: text("details"),
  link: text("link"),
  status: text("status", { enum: ["firing", "resolved"] }).notNull(),
  occurrences: integer("occurrences").notNull(),
  pendingRepeats: integer("pending_repeats").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type AlertRow = typeof alerts.$inferSelect;
