-- A stable surface for an app's own SQL (reports, recipient selection), so it never re-implements the recipient key
-- or reads the tables' internals: a change to the tables keeps these names and columns. Every name is qualified,
-- because a function runs with its caller's search_path.
-- Rollback: DROP VIEW mailing.suppressed_recipients; DROP VIEW mailing.delivery_outcomes;
--   DROP FUNCTION mailing.was_delivered(text, text); DROP FUNCTION mailing.is_suppressed(text);
--   DROP FUNCTION mailing.recipient_key(text);
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 5;

-- getRecipientKey in SQL: base64url SHA-256 (unpadded) of the address, lowercased and trimmed of the whitespace
-- JavaScript's trim() removes. lower() follows the database's ctype: under the C locale only ASCII letters are
-- lowercased, so an address with non-ASCII capitals keys differently there than in JavaScript.
CREATE FUNCTION recipient_key(address text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT rtrim(translate(encode(sha256(convert_to(lower(btrim(address,
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199)
    || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288)
    || chr(65279))), 'UTF8')), 'base64'), '+/', '-_'), '=')
$$;

-- Whether the address unsubscribed from list mail.
CREATE FUNCTION is_suppressed(address text) RETURNS boolean
  LANGUAGE sql STABLE STRICT PARALLEL SAFE AS $$
  SELECT EXISTS (SELECT 1 FROM mailing.suppressions WHERE recipient_key = mailing.recipient_key(address))
$$;

-- Whether a mail of this scope was sent to the address (a `sent` delivery, made by the module or imported).
CREATE FUNCTION was_delivered(scope text, address text) RETURNS boolean
  LANGUAGE sql STABLE STRICT PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM mailing.deliveries d
    WHERE d.scope = was_delivered.scope AND d.recipient_key = mailing.recipient_key(address) AND d.status = 'sent'
  )
$$;

-- The delivery ledger as app SQL may read it. status: pending, claimed, sent or rejected.
CREATE VIEW delivery_outcomes AS
  SELECT scope, recipient_key, kind, campaign_id, status, attempts, claimed_at, finished_at, imported_at
  FROM mailing.deliveries;

-- The suppression list as app SQL may read it. source: one-click, page or operator.
CREATE VIEW suppressed_recipients AS
  SELECT recipient_key, source, created_at
  FROM mailing.suppressions;
