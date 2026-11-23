-- The recipient key is now keyed by SOFTURE_EMAIL_KEY_SECRET (PBKDF2-HMAC-SHA256, see getRecipientKey), a secret only
-- the app server holds, so SQL can no longer compute it from an address. The functions that did go: a function that
-- kept computing the old SHA-256 key would silently miss every opt-out stored under the new one. The views stay. An
-- app's own SQL takes keys from getRecipientKey (e.g. `recipient_key = ANY($1::text[])` on the views).
-- Rows written before this version keep their SHA-256 keys and match no address any more; nothing rewrites them.
-- Rollback: re-run the CREATE FUNCTION statements of 0005_add_sql_surface.sql, then
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 6;
DROP FUNCTION mailing.was_delivered(text, text);
DROP FUNCTION mailing.is_suppressed(text);
DROP FUNCTION mailing.recipient_key(text);
