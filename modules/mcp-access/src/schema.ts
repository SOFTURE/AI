// Drizzle view of the module's table (migrations/0001_create_access_tokens.sql). The migration is
// the source of truth; this file only types the queries.
import { users } from "@softure-ai/auth";
import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const mcpSchema = pgSchema("mcp");

export const accessTokens = mcpSchema.table("access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique("access_tokens_token_hash_key"),
  canWrite: boolean("can_write").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
