// Drizzle view of the module's table (migrations/0001_create_funnel_counts.sql). The migration is
// the source of truth; this file only types the queries.
import { bigint, date, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";

export const analyticsSchema = pgSchema("analytics");

export const funnelCounts = analyticsSchema.table(
  "funnel_counts",
  {
    day: date("day").notNull(),
    channel: text("channel").notNull(),
    step: text("step").notNull(),
    count: bigint("count", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ name: "funnel_counts_pkey", columns: [table.day, table.channel, table.step] })],
);
