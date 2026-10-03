-- Access tokens for MCP clients. Only the sha256 of a token is stored: the plaintext leaves the
-- server once, in the answer to the issue action. A token belongs to one account and goes with it.
-- Rollback: DROP TABLE mcp.access_tokens; then
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 1;
CREATE TABLE access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The owner's label for the client that holds the token, e.g. "Laptop".
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name)),
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Issued with write access; writes also need the app's allowWrites option.
  can_write boolean NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  -- Informational, written at most once a minute per token; never an access decision.
  last_used_at timestamptz,
  CHECK (expires_at > created_at),
  CONSTRAINT access_tokens_token_hash_key UNIQUE (token_hash)
);

-- The owner's list, newest first, and the per-account limit.
CREATE INDEX access_tokens_user_id_created_at_idx ON access_tokens (user_id, created_at DESC);
-- Pruning deletes by expiry.
CREATE INDEX access_tokens_expires_at_idx ON access_tokens (expires_at);
