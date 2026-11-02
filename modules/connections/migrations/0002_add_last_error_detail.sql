-- What the token endpoint answered to the last failed refresh, beside its code in last_error: the HTTP status
-- (null when no answer came: a network failure or a timeout) and the OAuth `error` code (null when the answer had
-- none). Never the response body or the error description, which can quote a token.
-- Rollback: ALTER TABLE connections.accounts DROP CONSTRAINT accounts_error_detail_check;
--   ALTER TABLE connections.accounts DROP COLUMN last_error_oauth_error;
--   ALTER TABLE connections.accounts DROP COLUMN last_error_http_status;
--   DELETE FROM softure.migrations WHERE module = 'connections' AND version = 2;

ALTER TABLE accounts ADD COLUMN last_error_http_status integer CHECK (last_error_http_status BETWEEN 100 AND 599);
ALTER TABLE accounts ADD COLUMN last_error_oauth_error text CHECK (last_error_oauth_error ~ '^[\x20-\x7e]{1,100}$');
ALTER TABLE accounts ADD CONSTRAINT accounts_error_detail_check
  CHECK (last_error IS NOT NULL OR (last_error_http_status IS NULL AND last_error_oauth_error IS NULL));
