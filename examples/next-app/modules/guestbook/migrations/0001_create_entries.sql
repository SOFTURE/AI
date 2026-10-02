-- The guestbook entries of the example app.
-- Rollback: DROP TABLE guestbook.entries; then
--   DELETE FROM softure.migrations WHERE module = 'guestbook' AND version = 1;
CREATE TABLE entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
