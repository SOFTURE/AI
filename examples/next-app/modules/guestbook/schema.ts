// Drizzle views of the tables the app reads: the guestbook's own table and the migrator's ledger.
import { bigint, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const entries = pgSchema("guestbook").table("entries", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const migrationLedger = pgSchema("softure").table("migrations", {
  module: text("module").notNull(),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  method: text("method").notNull(),
});
