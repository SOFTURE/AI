-- The last terminal failure of a scheduled queue, so getQueueStats can tell whether it fails since its last success.
-- Rollback: ALTER TABLE jobs.schedules DROP COLUMN last_failed_at, DROP COLUMN last_failure_code; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 3;
ALTER TABLE schedules
  -- When a job of the schedule's queue last ended `failed`.
  ADD COLUMN last_failed_at timestamptz,
  -- That job's error code (`last_error`), never an error's text.
  ADD COLUMN last_failure_code text;
