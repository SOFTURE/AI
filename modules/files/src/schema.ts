// Drizzle view of the module's table (migrations/0001_create_files.sql). The migration is the source of truth;
// this file only types the queries.
import { bigint, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const filesSchema = pgSchema("files");

export const files = filesSchema.table("files", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  sha256: text("sha256").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  contentType: text("content_type").notNull(),
  originalName: text("original_name").notNull(),
  kind: text("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  linkGeneration: integer("link_generation").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export type FileRow = typeof files.$inferSelect;
