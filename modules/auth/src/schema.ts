// Drizzle view of the module's tables (migrations/0001_create_users_and_sessions.sql,
// 0002_create_user_roles.sql and 0003_create_password_resets.sql). The migrations are the source of
// truth; this file only types the queries. App tables may reference `users.id`.
import { pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique("users_email_key"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull(),
});

export const sessions = authSchema.table("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const userRoles = authSchema.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const passwordResets = authSchema.table("password_resets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique("password_resets_token_hash_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
