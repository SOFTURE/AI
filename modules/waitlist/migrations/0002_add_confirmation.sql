-- Double opt-in (waitlist({ doubleOptIn })): a sign-up counts once it is confirmed. With the option
-- off, a sign-up is confirmed when it is made; with it on, the request waits in pending_scopes until
-- the link in the confirmation mail is used. The link carries 32 random bytes; only their sha256 is
-- stored. A used link keeps its hash until the next request replaces it, so opening it again says
-- "confirmed". Rows that existed before this migration were counted at once, so they are confirmed
-- at their creation.
-- Rollback: first DELETE FROM waitlist.signups WHERE confirmed_at IS NULL (they hold no consent);
--   then DROP INDEX waitlist.signups_pending_expiry_idx; ALTER TABLE waitlist.signups
--   DROP COLUMN confirmed_at, DROP COLUMN pending_scopes, DROP COLUMN confirmation_token_hash,
--   DROP COLUMN confirmation_expires_at; then
--   DELETE FROM softure.migrations WHERE module = 'waitlist' AND version = 2;

ALTER TABLE signups
  -- When the sign-up first counted; NULL while its first request waits for the link.
  ADD COLUMN confirmed_at timestamptz,
  -- The scopes of a request that waits for the link (a first sign-up, or new scopes later).
  ADD COLUMN pending_scopes text[] CHECK (pending_scopes IS NULL OR is_scope_list(pending_scopes)),
  -- sha256 (hex) of the token in the latest link.
  ADD COLUMN confirmation_token_hash text CHECK (confirmation_token_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN confirmation_expires_at timestamptz;

UPDATE signups SET confirmed_at = created_at;

ALTER TABLE signups
  ADD CONSTRAINT signups_confirmation_token_hash_key UNIQUE (confirmation_token_hash),
  ADD CONSTRAINT signups_confirmation_link_check CHECK ((confirmation_token_hash IS NULL) = (confirmation_expires_at IS NULL)),
  ADD CONSTRAINT signups_pending_link_check CHECK (pending_scopes IS NULL OR confirmation_token_hash IS NOT NULL),
  -- A sign-up that never counted exists only for its pending request.
  ADD CONSTRAINT signups_unconfirmed_pending_check CHECK (confirmed_at IS NOT NULL OR pending_scopes IS NOT NULL),
  ADD CONSTRAINT signups_confirmed_at_check CHECK (confirmed_at IS NULL OR confirmed_at >= created_at);

-- The prune of expired requests (pruneUnconfirmedSignups).
CREATE INDEX signups_pending_expiry_idx ON signups (confirmation_expires_at) WHERE pending_scopes IS NOT NULL;
