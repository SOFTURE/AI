// Drizzle view of the module's tables (migrations/). The migrations are the source of truth; this
// file only types the queries.
import { integer, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const mailingSchema = pgSchema("mailing");

export const suppressions = mailingSchema.table("suppressions", {
  recipientKey: text("recipient_key").primaryKey(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const campaigns = mailingSchema.table("campaigns", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const deliveries = mailingSchema.table(
  "deliveries",
  {
    scope: text("scope").notNull(),
    recipientKey: text("recipient_key").notNull(),
    kind: text("kind").notNull(),
    campaignId: text("campaign_id"),
    status: text("status").$type<DeliveryStatus>().notNull(),
    attempts: integer("attempts").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    reason: text("reason"),
    /** The provider's HTTP status of the last answer that failed or was released; null when there was none. */
    providerStatus: integer("provider_status"),
    /** When `importDeliveries` wrote the row; null for a delivery the module made. */
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.recipientKey] })],
);

/** A ledger row's state: `pending` (released for a retry), `claimed`, or a final `sent` / `rejected`. */
export type DeliveryStatus = "pending" | "claimed" | "sent" | "rejected";
