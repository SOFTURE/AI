-- The run history: what started each job (`origin`), and one row per recorded attempt with its outcome and the
-- handler's code-only summary. Runs have their own retention, so they outlive the jobs pruning deletes; no foreign
-- key ties them to `jobs.jobs`.
-- Rollback: DROP TABLE jobs.runs; ALTER TABLE jobs.jobs DROP COLUMN origin; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 6;
ALTER TABLE jobs
  ADD COLUMN origin text NOT NULL DEFAULT 'app'
    CONSTRAINT jobs_origin_check CHECK (origin ~ '^[a-z][a-z0-9_.-]{0,62}$');

CREATE TABLE runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  queue text NOT NULL CHECK (queue ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  origin text NOT NULL CHECK (origin ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  attempt integer NOT NULL CHECK (attempt >= 1),
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'retried', 'failed')),
  -- An error code, never a message, as `jobs.last_error`.
  error_code text CHECK (char_length(error_code) BETWEEN 1 AND 200),
  -- The handler's summary (codes and counts only), checked by the module before it is written.
  summary jsonb,
  -- Null when the attempt's start is unknown: a lease that ended with no attempts left.
  started_at timestamptz,
  finished_at timestamptz NOT NULL,
  CHECK ((outcome = 'succeeded') = (error_code IS NULL)),
  CHECK (summary IS NULL OR outcome = 'succeeded'),
  CHECK (summary IS NULL OR jsonb_typeof(summary) = 'object')
);

-- The history page reads the newest runs, of one queue or all; pruning deletes by age.
CREATE INDEX runs_finished_at_idx ON runs (finished_at, id);
CREATE INDEX runs_queue_finished_at_idx ON runs (queue, finished_at, id);
