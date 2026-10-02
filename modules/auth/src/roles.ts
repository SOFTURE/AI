// Role names shared by the options, the server functions and the migration's CHECK constraint.

/** The role every app has: admin-only surfaces ask for it. */
export const ADMIN_ROLE = "admin";

/** What a role name looks like; `migrations/0002_create_user_roles.sql` enforces the same shape. */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
