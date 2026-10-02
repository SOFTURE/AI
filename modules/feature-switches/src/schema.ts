// Drizzle view of the module's table (migrations/0001_create_switches.sql). The migration is the
// source of truth; this file only types the queries.
import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const featuresSchema = pgSchema("features");

export const switches = featuresSchema.table("switches", {
  name: text("name").primaryKey(),
  enabled: boolean("enabled").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  updatedBy: text("updated_by"),
});
