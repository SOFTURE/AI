-- Recurring schedules: per schedule the last period a worker enqueued a run for, and when a run last succeeded.
-- Rollback: DROP TABLE jobs.schedules; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 2;
CREATE TABLE schedules (
  -- The schedule's queue.
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  -- The start of the latest period a run was enqueued for; a worker takes a period only when it is later than this.
  last_slot_at timestamptz NOT NULL,
  last_succeeded_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
