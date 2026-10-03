-- Waitlist sign-ups: one row per email address, with the consent scopes it granted and the form
-- placement it first signed up from. Scopes and placements are the app's (waitlist({ scopes,
-- placements })), so the table checks their shape and the module checks them against the config;
-- no app value is hard-coded here. The evidence of each consent lives in privacy.consents.
-- Rollback: DROP TABLE waitlist.signups; DROP FUNCTION waitlist.is_scope_list(text[]); then
--   DELETE FROM softure.migrations WHERE module = 'waitlist' AND version = 1;

-- 1 to 16 distinct scopes, each kebab-case and at most 64 characters (a consent purpose in
-- privacy.consents), without NULLs.
CREATE FUNCTION is_scope_list(scopes text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT cardinality(scopes) BETWEEN 1 AND 16
    AND NOT EXISTS (
      SELECT 1 FROM unnest(scopes) AS s(scope)
      WHERE scope IS NULL OR char_length(scope) > 64 OR scope !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    )
    AND (SELECT count(DISTINCT scope) FROM unnest(scopes) AS s(scope)) = cardinality(scopes)
$$;

CREATE TABLE signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored trimmed and lowercased, so the unique constraint is the case-insensitive one.
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  -- Granted scopes in the config's order; a repeat sign-up widens them, never narrows them.
  scopes text[] NOT NULL CHECK (is_scope_list(scopes)),
  -- Where the first sign-up came from, e.g. hero or footer.
  placement text NOT NULL CHECK (char_length(placement) <= 64 AND placement ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  -- The app's locale at the first sign-up: the language of the mail it gets.
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT signups_email_key UNIQUE (email),
  CHECK (updated_at >= created_at)
);

-- Lists by scope (a launch mail to everyone who asked for it).
CREATE INDEX signups_scopes_idx ON signups USING gin (scopes);
