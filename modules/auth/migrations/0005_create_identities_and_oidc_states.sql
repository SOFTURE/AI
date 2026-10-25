-- OpenID Connect sign-in: the provider identities linked to accounts, and the sign-ins in flight.
-- Rollback: DROP TABLE auth.oidc_states; DROP TABLE auth.identities; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 5;

-- An account's identity at a provider: the provider's stable subject, never the email, finds the account, so an
-- email change at the provider does not lock its owner out. One identity per provider and account, so a recycled
-- address with a new subject cannot take an account over.
CREATE TABLE identities (
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9-]{0,31}$'),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- The verified email the provider sent at the last sign-in, trimmed and lowercased.
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  created_at timestamptz NOT NULL,
  last_login_at timestamptz NOT NULL,
  PRIMARY KEY (provider, subject),
  CONSTRAINT identities_user_provider_key UNIQUE (user_id, provider)
);

-- A sign-in in flight: the sha256 of its state (the state itself is in the browser's cookie), the nonce the ID token
-- must carry, the PKCE verifier and the path to return to. One-time and short-lived; expired rows are removed
-- whenever a new sign-in starts.
CREATE TABLE oidc_states (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9-]{0,31}$'),
  nonce text NOT NULL CHECK (nonce ~ '^[A-Za-z0-9_-]{43}$'),
  code_verifier text NOT NULL CHECK (code_verifier ~ '^[A-Za-z0-9_-]{43}$'),
  next_path text NOT NULL CHECK (next_path LIKE '/%' AND char_length(next_path) <= 8192),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX oidc_states_expires_at_idx ON oidc_states (expires_at);
