-- The recipients who unsubscribed from list mail (every kind but `transactional`). One row per
-- address, global across kinds. The address itself is never stored: `recipient_key` is the
-- base64url SHA-256 of the trimmed, lowercased address (getRecipientKey), the same value the
-- signed unsubscribe link carries. A second unsubscribe keeps the first row.
-- Rollback: DROP TABLE mailing.suppressions; then
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 1;
CREATE TABLE suppressions (
  recipient_key text PRIMARY KEY CHECK (recipient_key ~ '^[A-Za-z0-9_-]{43}$'),
  -- How the opt-out arrived: a mail client's one-click POST, the unsubscribe page's button, or an
  -- operator (suppressRecipient from a script or another module).
  source text NOT NULL CHECK (source IN ('one-click', 'page', 'operator')),
  created_at timestamptz NOT NULL
);
