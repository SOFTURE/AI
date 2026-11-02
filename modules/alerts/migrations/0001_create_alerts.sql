-- One row per alert key: whether it fires, how often it happened and what was not reported yet.
-- Rollback: DROP TABLE alerts.alerts; then
--   DELETE FROM softure.migrations WHERE module = 'alerts' AND version = 1;
CREATE TABLE alerts (
  key text PRIMARY KEY CHECK (key ~ '^[A-Za-z0-9._:/@-]{1,200}$'),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  details text CHECK (char_length(details) BETWEEN 1 AND 4000),
  link text CHECK (char_length(link) BETWEEN 1 AND 2000),
  status text NOT NULL CHECK (status IN ('firing', 'resolved')),
  -- Since the alert started firing, the first occurrence included.
  occurrences integer NOT NULL CHECK (occurrences >= 1),
  -- Occurrences counted since the last message and not reported yet.
  pending_repeats integer NOT NULL CHECK (pending_repeats >= 0),
  opened_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  last_notified_at timestamptz NOT NULL,
  resolved_at timestamptz,
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CHECK (pending_repeats < occurrences)
);

-- The admin list (newest first) and the flush job's scan of firing alerts with repeats to report.
CREATE INDEX alerts_last_seen_idx ON alerts (last_seen_at DESC);
CREATE INDEX alerts_pending_idx ON alerts (last_notified_at) WHERE status = 'firing' AND pending_repeats > 0;
