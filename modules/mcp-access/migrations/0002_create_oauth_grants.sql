-- OAuth 2.1 for MCP clients (opt-in, `oauth.enabled`): clients registered dynamically, short-lived
-- authorization codes, and one grant per account and client carrying a rotated refresh token. An
-- access token issued through OAuth is a row of access_tokens with its grant; revoking the grant
-- deletes its tokens by cascade. Every secret is stored as its sha256 only.
-- Rollback: ALTER TABLE mcp.access_tokens DROP COLUMN grant_id;
--   DROP TABLE mcp.oauth_grants, mcp.oauth_authorization_codes, mcp.oauth_clients; then
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 2;
CREATE TABLE oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Public identifier the client sends (RFC 6749 §2.2); not a secret.
  client_id text NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 255),
  -- Shown on the consent page and in the connected apps list; also the name of its access tokens.
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 60 AND client_name = btrim(client_name)),
  redirect_uris jsonb NOT NULL CHECK (jsonb_typeof(redirect_uris) = 'array' AND jsonb_array_length(redirect_uris) BETWEEN 1 AND 10),
  token_endpoint_auth_method text NOT NULL CHECK (token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic')),
  -- Only for confidential clients; a public client (`none`) is protected by PKCE alone.
  client_secret_hash text CHECK (client_secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id),
  CONSTRAINT oauth_clients_secret_matches_method CHECK ((token_endpoint_auth_method = 'none') = (client_secret_hash IS NULL))
);

CREATE TABLE oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  client_id uuid NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  -- PKCE S256 challenge: base64url of a sha256, always 43 characters.
  code_challenge text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  can_write boolean NOT NULL,
  expires_at timestamptz NOT NULL,
  -- Set by the one exchange that may use the code; a second use revokes the grant it produced.
  used_at timestamptz,
  created_at timestamptz NOT NULL,
  CHECK (expires_at > created_at),
  CONSTRAINT oauth_authorization_codes_code_hash_key UNIQUE (code_hash)
);

CREATE INDEX oauth_authorization_codes_client_id_idx ON oauth_authorization_codes (client_id);
CREATE INDEX oauth_authorization_codes_user_id_idx ON oauth_authorization_codes (user_id);
CREATE INDEX oauth_authorization_codes_expires_at_idx ON oauth_authorization_codes (expires_at);

CREATE TABLE oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
  -- Granted write access; writes also need the app's allowWrites option.
  can_write boolean NOT NULL,
  refresh_token_hash text NOT NULL CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  -- The refresh token before the last rotation: presenting it again revokes the grant.
  previous_refresh_token_hash text CHECK (previous_refresh_token_hash ~ '^[0-9a-f]{64}$'),
  refresh_expires_at timestamptz NOT NULL,
  -- Informational, written at most once a minute; never an access decision.
  last_used_at timestamptz,
  created_at timestamptz NOT NULL,
  CONSTRAINT oauth_grants_refresh_token_hash_key UNIQUE (refresh_token_hash),
  -- One grant per account and client: a new consent replaces the old grant.
  CONSTRAINT oauth_grants_user_id_client_id_key UNIQUE (user_id, client_id)
);

CREATE INDEX oauth_grants_client_id_idx ON oauth_grants (client_id);
CREATE INDEX oauth_grants_previous_refresh_token_hash_idx ON oauth_grants (previous_refresh_token_hash);
CREATE INDEX oauth_grants_refresh_expires_at_idx ON oauth_grants (refresh_expires_at);

-- The grant an access token was issued from; null for a token issued on the token page.
ALTER TABLE access_tokens ADD COLUMN grant_id uuid REFERENCES oauth_grants (id) ON DELETE CASCADE;
CREATE INDEX access_tokens_grant_id_idx ON access_tokens (grant_id);
