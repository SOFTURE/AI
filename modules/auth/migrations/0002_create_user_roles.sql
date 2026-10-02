-- Roles granted to accounts. A role an app checks must also be declared in auth({ roles }); `admin`
-- is always declared. Admins listed in auth({ adminEmails }) are never stored here.
-- Rollback: DROP TABLE auth.user_roles; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 2;
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role ~ '^[a-z][a-z0-9_-]{0,31}$'),
  granted_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, role)
);
