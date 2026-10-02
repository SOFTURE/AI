-- Fixed-window rate limit counters: one row per bucket and client key.
-- Rollback: DROP TABLE security.rate_limits; then
--   DELETE FROM softure.migrations WHERE module = 'security' AND version = 1;
CREATE TABLE rate_limits (
  bucket text NOT NULL CHECK (bucket ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  identifier text NOT NULL CHECK (char_length(identifier) BETWEEN 1 AND 200),
  attempts integer NOT NULL CHECK (attempts >= 1),
  window_started_at timestamptz NOT NULL,
  PRIMARY KEY (bucket, identifier)
);

-- Cleanup deletes by age; without the index every cleanup scans the whole table.
CREATE INDEX rate_limits_window_started_at_idx ON rate_limits (window_started_at);
