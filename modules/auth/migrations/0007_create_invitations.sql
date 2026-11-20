-- Invitations an admin sends while registration may be closed. Only the sha256 of a link's token is stored, and at most
-- one invitation per email is pending (neither accepted nor revoked); inviting the email again refreshes that row.
-- Accepting sets accepted_at and the account it created, in the registration transaction; revoking sets revoked_at.
-- The inviter and the created account are kept as ids (set to null when the account is deleted).
-- Rollback: DROP TABLE auth.invitations; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 7;
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  -- Role names as in auth.user_roles, granted to the account on acceptance.
  roles text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(roles) <= 16 AND array_to_string(roles, ',') ~ '^([a-z][a-z0-9_-]{0,31}(,[a-z][a-z0-9_-]{0,31})*)?$'),
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  CONSTRAINT invitations_token_hash_key UNIQUE (token_hash)
);

CREATE UNIQUE INDEX invitations_pending_email_key ON invitations (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- The admin page lists the newest first.
CREATE INDEX invitations_created_at_idx ON invitations (created_at);
