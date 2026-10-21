-- The app's connections to third-party accounts (OAuth grants, API keys, Basic credentials) and the
-- authorizations in flight. Secrets are stored only as AES-256-GCM ciphertexts, with the id of the key that
-- sealed them; nothing here is readable without the keyring in SOFTURE_CONNECTIONS_KEYS.
-- Rollback: DROP TABLE connections.oauth_states; DROP TABLE connections.accounts; then
--   DELETE FROM softure.migrations WHERE module = 'connections' AND version = 1;
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND char_length(provider) <= 64),
  account_id text NOT NULL CHECK (account_id ~ '^[a-z0-9][a-z0-9_-]*$' AND char_length(account_id) <= 64),
  kind text NOT NULL CHECK (kind IN ('oauth', 'api_key', 'basic')),
  status text NOT NULL CHECK (status IN ('connected', 'reconnect_required')),
  -- The id of the keyring key that sealed `credentials`.
  key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  -- The sealed credential: the tokens of an OAuth grant, an API key, or a username and password.
  credentials text NOT NULL CHECK (char_length(credentials) BETWEEN 1 AND 65536),
  token_type text CHECK (char_length(token_type) BETWEEN 1 AND 40),
  scopes text[] NOT NULL DEFAULT '{}',
  -- Whether the sealed OAuth credential holds a refresh token, so the page can tell without opening it.
  has_refresh_token boolean NOT NULL DEFAULT false,
  -- When the access token expires; null when the provider gave no expiry (or for a key).
  expires_at timestamptz,
  -- When the refresh token dies (refresh_token_expires_in, or the provider's configured maximum age).
  refresh_expires_at timestamptz,
  connected_at timestamptz NOT NULL,
  -- The auth user id of the admin who connected it; null once that account is deleted or for an operator.
  -- No foreign key: deleting an account must not delete the app's connection.
  connected_by text CHECK (char_length(connected_by) BETWEEN 1 AND 200),
  refreshed_at timestamptz,
  -- The code of the last failure (never a provider message, which can quote a token).
  last_error text CHECK (last_error ~ '^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$' AND char_length(last_error) <= 100),
  last_error_at timestamptz,
  updated_at timestamptz NOT NULL,
  -- The refresh lease: one refresher per connection across processes.
  lease_id uuid,
  lease_until timestamptz,
  CONSTRAINT accounts_provider_account_key UNIQUE (provider, account_id),
  CONSTRAINT accounts_lease_pair_check CHECK ((lease_id IS NULL) = (lease_until IS NULL)),
  CONSTRAINT accounts_error_pair_check CHECK ((last_error IS NULL) = (last_error_at IS NULL)),
  CONSTRAINT accounts_key_fields_check CHECK (kind = 'oauth' OR (token_type IS NULL AND expires_at IS NULL AND refresh_expires_at IS NULL AND NOT has_refresh_token))
);

-- An authorization in flight: the state's sha256, never the state itself, and the sealed PKCE verifier.
-- One-time and short-lived; expired rows are removed whenever a new authorization starts.
CREATE TABLE oauth_states (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  provider text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 64),
  account_id text NOT NULL CHECK (char_length(account_id) BETWEEN 1 AND 64),
  key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  -- The sealed PKCE verifier; null when the provider runs without PKCE.
  verifier text CHECK (char_length(verifier) BETWEEN 1 AND 1024),
  -- The admin who started it; only the same user can complete it.
  created_by text NOT NULL CHECK (char_length(created_by) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT oauth_states_window_check CHECK (expires_at > created_at)
);

CREATE INDEX oauth_states_expires_at_idx ON oauth_states (expires_at);
