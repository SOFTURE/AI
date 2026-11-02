-- Progress a running handler reports (`context.reportProgress`) and a cancel request for a running job
-- (`requestJobCancel`). Progress is code-only JSON, checked by the module before it is written, like a run summary.
-- A cancelled attempt leaves a run with the outcome `cancelled` and the code `jobs.cancelled`.
-- Rollback: UPDATE jobs.runs SET outcome = 'failed' WHERE outcome = 'cancelled';
--   ALTER TABLE jobs.runs DROP CONSTRAINT runs_outcome_check;
--   ALTER TABLE jobs.runs ADD CONSTRAINT runs_outcome_check CHECK (outcome IN ('succeeded', 'retried', 'failed'));
--   ALTER TABLE jobs.jobs DROP COLUMN progress, DROP COLUMN progress_at, DROP COLUMN cancel_requested_at; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 7;
ALTER TABLE jobs
  ADD COLUMN progress jsonb CONSTRAINT jobs_progress_check CHECK (progress IS NULL OR jsonb_typeof(progress) = 'object'),
  ADD COLUMN progress_at timestamptz,
  -- When an operator asked a running job to stop; kept on the cancelled job for inspection.
  ADD COLUMN cancel_requested_at timestamptz,
  ADD CONSTRAINT jobs_progress_at_check CHECK ((progress IS NULL) = (progress_at IS NULL)),
  ADD CONSTRAINT jobs_cancel_requested_check CHECK (cancel_requested_at IS NULL OR status IN ('running', 'cancelled'));

ALTER TABLE runs DROP CONSTRAINT runs_outcome_check;
ALTER TABLE runs ADD CONSTRAINT runs_outcome_check CHECK (outcome IN ('succeeded', 'retried', 'failed', 'cancelled'));
