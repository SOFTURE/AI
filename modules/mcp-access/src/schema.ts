// Drizzle view of the module's tables (migrations/0001_create_access_tokens.sql and
// 0002_create_oauth_grants.sql). The migrations are the source of truth; this file only types the
// queries.
import { users } from "@softure-ai/auth";
import { boolean, jsonb, pgSchema, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

export const mcpSchema = pgSchema("mcp");

export const oauthClients = mcpSchema.table("oauth_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().unique("oauth_clients_client_id_key"),
  clientName: text("client_name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method").$type<"none" | "client_secret_post" | "client_secret_basic">().notNull(),
  clientSecretHash: text("client_secret_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const oauthAuthorizationCodes = mcpSchema.table("oauth_authorization_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique("oauth_authorization_codes_code_hash_key"),
  clientId: uuid("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  canWrite: boolean("can_write").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const oauthGrants = mcpSchema.table("oauth_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  canWrite: boolean("can_write").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull().unique("oauth_grants_refresh_token_hash_key"),
  previousRefreshTokenHash: text("previous_refresh_token_hash"),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

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
  grantId: uuid("grant_id").references((): AnyPgColumn => oauthGrants.id, { onDelete: "cascade" }),
});

export type OAuthClientRow = typeof oauthClients.$inferSelect;
export type OAuthTokenEndpointAuthMethod = OAuthClientRow["tokenEndpointAuthMethod"];
