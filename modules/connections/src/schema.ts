// Drizzle view of the module's tables (migrations/0001_create_accounts_and_states.sql). The migration is the
// source of truth; this file only types the queries.
import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const connectionsSchema = pgSchema("connections");

export const accounts = connectionsSchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  accountId: text("account_id").notNull(),
  kind: text("kind", { enum: ["oauth", "api_key", "basic"] }).notNull(),
  status: text("status", { enum: ["connected", "reconnect_required"] }).notNull(),
  keyId: text("key_id").notNull(),
  credentials: text("credentials").notNull(),
  tokenType: text("token_type"),
  scopes: text("scopes").array().notNull(),
  hasRefreshToken: boolean("has_refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull(),
  connectedBy: text("connected_by"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  leaseId: uuid("lease_id"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
});

export const oauthStates = connectionsSchema.table("oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  provider: text("provider").notNull(),
  accountId: text("account_id").notNull(),
  keyId: text("key_id").notNull(),
  verifier: text("verifier"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type AccountRow = typeof accounts.$inferSelect;
