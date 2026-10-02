-- Accounts and their database sessions.
-- Rollback: DROP TABLE auth.sessions; DROP TABLE auth.users; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 1;
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored trimmed and lowercased, so the unique constraint is the case-insensitive one.
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  created_at timestamptz NOT NULL,
  password_changed_at timestamptz NOT NULL,
  CONSTRAINT users_email_key UNIQUE (email)
);

-- Only the sha256 of a session token is stored; the token itself lives in the cookie alone.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

-- A password change and the login cleanup delete by user; pruning deletes by age.
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
