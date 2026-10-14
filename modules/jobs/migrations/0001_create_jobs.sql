-- Background jobs: one row per job, claimed by workers under a lease.
-- Rollback: DROP TABLE jobs.jobs; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 1;
CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue text NOT NULL CHECK (queue ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  -- Claims so far; a release on shutdown gives its attempt back.
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 1000),
  run_at timestamptz NOT NULL,
  locked_until timestamptz,
  locked_by text CHECK (char_length(locked_by) BETWEEN 1 AND 200),
  -- New on every claim: a completion, a lease extension or a release names it, so a worker whose job was taken
  -- over or released cannot record anything for the newer claim.
  claim_token uuid,
  dedup_key text CHECK (char_length(dedup_key) BETWEEN 1 AND 200),
  -- An error code, never a message: payload data must not leak into it.
  last_error text CHECK (char_length(last_error) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  finished_at timestamptz,
  CHECK ((status = 'running') = (locked_until IS NOT NULL AND locked_by IS NOT NULL AND claim_token IS NOT NULL)),
  CHECK (status = 'running' OR (locked_until IS NULL AND locked_by IS NULL AND claim_token IS NULL)),
  CHECK ((status IN ('succeeded', 'failed', 'cancelled')) = (finished_at IS NOT NULL)),
  CHECK (status <> 'running' OR attempts >= 1)
);

-- One live job per dedup key and queue; a finished job frees its key.
CREATE UNIQUE INDEX jobs_dedup_key_idx ON jobs (queue, dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('pending', 'running');

-- The claim reads due pending jobs and running jobs whose lease ended, per queue.
CREATE INDEX jobs_pending_due_idx ON jobs (queue, run_at, id) WHERE status = 'pending';
CREATE INDEX jobs_running_lease_idx ON jobs (queue, locked_until) WHERE status = 'running';

-- Pruning deletes finished jobs by age.
CREATE INDEX jobs_finished_at_idx ON jobs (finished_at) WHERE finished_at IS NOT NULL;
