-- The schedule health last reported to the app's onScheduleStateChanged hook, so each transition is reported once
-- however many workers check it.
-- Rollback: ALTER TABLE jobs.schedules DROP COLUMN reported_state; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 5;
ALTER TABLE schedules
  ADD COLUMN reported_state text NOT NULL DEFAULT 'healthy'
    CONSTRAINT schedules_reported_state_check CHECK (reported_state IN ('healthy', 'failing', 'late'));
