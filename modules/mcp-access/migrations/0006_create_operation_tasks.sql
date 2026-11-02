-- MCP Tasks over long operations (#977): a client that declares the Tasks extension gets a task id instead of an
-- operation id. The task id is random (32 bytes, base64url), since the spec requires ids nobody can guess, and points
-- to the operation's job in @softure-ai/jobs (no foreign key: jobs is an optional module). One account reuses one task
-- per job. `expires_at` ends the task (`ttlMs`); pruning deletes the row after it. A task goes with its account.
-- Rollback: DROP TABLE mcp.operation_tasks; then
--   DELETE FROM softure.migrations WHERE module = 'mcp-access' AND version = 6;
CREATE TABLE operation_tasks (
  task_id text PRIMARY KEY CHECK (task_id ~ '^[A-Za-z0-9_-]{43}$'),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id bigint NOT NULL CHECK (job_id > 0),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at),
  CONSTRAINT operation_tasks_user_id_job_id_key UNIQUE (user_id, job_id)
);

-- Pruning deletes by expiry.
CREATE INDEX operation_tasks_expires_at_idx ON operation_tasks (expires_at);
