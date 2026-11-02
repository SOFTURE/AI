-- Confirmation tokens of confirmed tool calls (#953) that have been used once. A token is a stateless HMAC; this
-- table only makes it single use: the second call inserts its hash before the tool's work runs, and a conflict
-- means the token was used already. `expires_at` is the token's own expiry, after which the row is pruned. It
-- holds no personal data.
-- Rollback: DROP TABLE mcp.used_confirmations; then
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 4;
CREATE TABLE used_confirmations (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX used_confirmations_expires_at_idx ON used_confirmations (expires_at);
