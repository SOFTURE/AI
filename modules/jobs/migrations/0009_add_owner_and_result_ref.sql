-- The user a job belongs to (`enqueueJob({ ownerId })`), so that user can follow it (`getOwnJob`), and the reference
-- to the result a succeeded handler returned (`ok({ resultRef })`): an id of the app's own row, never the result itself.
-- Rollback: DROP INDEX jobs.jobs_owner_idx;
--   ALTER TABLE jobs.jobs DROP COLUMN owner_id, DROP COLUMN result_ref; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 9;
ALTER TABLE jobs
  ADD COLUMN owner_id text CONSTRAINT jobs_owner_id_check CHECK (char_length(owner_id) BETWEEN 1 AND 200),
  ADD COLUMN result_ref text CONSTRAINT jobs_result_ref_check CHECK (char_length(result_ref) BETWEEN 1 AND 200),
  ADD CONSTRAINT jobs_result_ref_status_check CHECK (result_ref IS NULL OR status = 'succeeded');

-- An owner's jobs, newest first.
CREATE INDEX jobs_owner_idx ON jobs (owner_id, created_at DESC) WHERE owner_id IS NOT NULL;
