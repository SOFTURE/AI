-- The consent ledger: who agreed to what, when, from where and against which version of which
-- legal document. Append-only: a withdrawal is a new row with granted = false, and the trigger
-- below refuses any UPDATE, so the evidence of an earlier consent cannot be rewritten. Rows are
-- deleted only with the person's data (the privacy contributor, on account deletion).
-- A subject is either an account (user_id) or an email address without one (email_key: the
-- base64url SHA-256 of the trimmed, lowercased address; the address itself is never stored).
-- Rollback: DROP TABLE privacy.consents; DROP FUNCTION privacy.refuse_consent_update(); then
--   DELETE FROM softure.migrations WHERE module = 'privacy' AND version = 1;
CREATE TABLE consents (
  -- Orders rows recorded in the same instant: the latest row of a purpose is its current state.
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  email_key text CHECK (email_key ~ '^[A-Za-z0-9_-]{43}$'),
  -- What the consent is for, e.g. terms, privacy-policy, newsletter.
  purpose text NOT NULL CHECK (char_length(purpose) <= 64 AND purpose ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  granted boolean NOT NULL,
  -- The legal document the person saw, with the version the app declared at that moment.
  document_id text CHECK (char_length(document_id) <= 64 AND document_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  document_version text CHECK (document_version ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$'),
  -- Where it was given, e.g. registration, waitlist, account.
  source text NOT NULL CHECK (char_length(source) <= 64 AND source ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  recorded_at timestamptz NOT NULL,
  CONSTRAINT consents_one_subject CHECK (num_nonnulls(user_id, email_key) = 1),
  CONSTRAINT consents_document_with_version CHECK ((document_id IS NULL) = (document_version IS NULL))
);

-- The current state and the history of a subject, per purpose, newest first.
CREATE INDEX consents_user_id_idx ON consents (user_id, purpose, recorded_at DESC, id DESC) WHERE user_id IS NOT NULL;
CREATE INDEX consents_email_key_idx ON consents (email_key, purpose, recorded_at DESC, id DESC) WHERE email_key IS NOT NULL;

CREATE FUNCTION refuse_consent_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'privacy.consents is append-only: record a new row instead of updating row %', OLD.id;
END
$$;

CREATE TRIGGER consents_append_only BEFORE UPDATE ON consents FOR EACH ROW EXECUTE FUNCTION refuse_consent_update();
