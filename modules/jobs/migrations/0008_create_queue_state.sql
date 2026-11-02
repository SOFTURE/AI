-- Per-queue state shared by every worker: the pacing budget (`rateLimit`), the circuit breaker's counter and a pause
-- (breaker, handler or operator). A queue gets its row the first time it needs one.
-- Rollback: DROP TABLE jobs.queue_state; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 8;
CREATE TABLE queue_state (
  queue text PRIMARY KEY CHECK (queue ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  -- `rateLimit: { minGapMs }`: the earliest moment the next job may be claimed.
  next_allowed_at timestamptz,
  -- `rateLimit: { max, perSeconds }`: the start of the current window and the claims made in it.
  window_started_at timestamptz,
  window_count integer NOT NULL DEFAULT 0 CHECK (window_count >= 0),
  -- `breaker`: counted failures since the last success.
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  -- The length of the last breaker pause, kept until a success, so the next trip doubles it.
  last_pause_seconds integer CHECK (last_pause_seconds >= 1),
  pause_source text CHECK (pause_source IN ('breaker', 'handler', 'operator')),
  -- An error code, or an operator's short reason; never a payload or an error text.
  pause_reason text CHECK (char_length(pause_reason) BETWEEN 1 AND 200),
  -- Null with an operator pause: paused until resumed.
  paused_until timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK ((pause_source IS NULL) = (pause_reason IS NULL)),
  CHECK (pause_source IS NOT NULL OR paused_until IS NULL),
  CHECK (pause_source IS NULL OR pause_source = 'operator' OR paused_until IS NOT NULL)
);
