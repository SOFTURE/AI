-- The heartbeat of a worker without a process of its own (the Workers tick, `runJobsTick`): when it last ran a round
-- whose claims reached the database, and when it last pruned, so ticks that overlap prune once an hour.
-- Rollback: DROP TABLE jobs.worker_heartbeats; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 10;
CREATE TABLE worker_heartbeats (
  worker_id text PRIMARY KEY CHECK (char_length(worker_id) BETWEEN 1 AND 200),
  beat_at timestamptz,
  pruned_at timestamptz
);
