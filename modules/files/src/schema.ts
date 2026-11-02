// Drizzle view of the module's tables (migrations 0001 and 0002). The migrations are the source of truth; this file
// only types the queries.
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

export const uploads = filesSchema.table("uploads", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  kind: text("kind").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  sha256: text("sha256"),
  chunkSize: integer("chunk_size").notNull(),
  receivedChunks: integer("received_chunks").array().notNull(),
  fileId: uuid("file_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

export type UploadRow = typeof uploads.$inferSelect;
