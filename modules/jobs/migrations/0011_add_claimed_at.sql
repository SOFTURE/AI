-- When the current (or last) attempt of a job was claimed: the start of a running job. `updated_at` cannot tell it,
-- since every lease extension moves it. Null for a job never claimed, or last claimed before this migration.
-- Rollback: ALTER TABLE jobs.jobs DROP COLUMN claimed_at; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 11;
ALTER TABLE jobs ADD COLUMN claimed_at timestamptz;
