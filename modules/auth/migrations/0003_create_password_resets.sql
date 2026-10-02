-- Pending password resets: at most one per account (a new request replaces the token), only the
-- sha256 of the token is stored, and a reset deletes its row, so a link works once.
-- Rollback: DROP TABLE auth.password_resets; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 3;
CREATE TABLE password_resets (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at),
  CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash)
);

-- Pruning deletes by age.
CREATE INDEX password_resets_expires_at_idx ON password_resets (expires_at);
