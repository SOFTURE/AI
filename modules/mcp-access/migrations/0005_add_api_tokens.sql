-- Personal tokens for an app's plain HTTP routes (#961) live next to the MCP tokens: same hashing, expiry, limit,
-- page, privacy and prune. `kind` keeps them apart (an API token never opens the MCP endpoint, an MCP token never
-- passes `requireApiToken`); `scopes` holds the app scopes an API token was issued with. Existing rows become
-- `mcp` tokens with no scopes through the defaults.
-- Rollback: DELETE FROM mcp.access_tokens WHERE kind = 'api';
--   ALTER TABLE mcp.access_tokens DROP CONSTRAINT access_tokens_kind_scopes_check, DROP COLUMN scopes, DROP COLUMN kind;
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 5;
ALTER TABLE access_tokens
  ADD COLUMN kind text NOT NULL DEFAULT 'mcp',
  ADD COLUMN scopes text[] NOT NULL DEFAULT '{}';

ALTER TABLE access_tokens ADD CONSTRAINT access_tokens_kind_scopes_check CHECK (
  (kind = 'mcp' AND cardinality(scopes) = 0)
  OR (kind = 'api' AND grant_id IS NULL AND cardinality(scopes) BETWEEN 1 AND 32 AND array_position(scopes, NULL) IS NULL)
);
