-- The window in which dynamic client registration is open while `oauth.registration` is "closed"
-- (#520): at most one row, written by the `open-client-registration` ops script and deleted by
-- `close-client-registration`. No row, or one whose open_until has passed, keeps registration closed.
-- Rollback: DROP TABLE mcp.oauth_registration_window; then
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 3;
CREATE TABLE oauth_registration_window (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  opened_at timestamptz NOT NULL,
  open_until timestamptz NOT NULL,
  CONSTRAINT oauth_registration_window_ends_after_open CHECK (open_until > opened_at)
);
