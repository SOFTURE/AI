-- One row per off-site backup run of the host (`softure-backup upload`, called by deploy.sh maintain): when it ran,
-- how it ended, and the objects it uploaded. Written by the host run as the postgres superuser, read by the app
-- (`getLastBackup`, `listBackupRuns`, the backup metrics). Errors are safe codes and messages, never a secret.
-- Rollback: DROP TABLE backup.runs; then
--   DELETE FROM softure.migrations WHERE module = 'backup' AND version = 1;
CREATE TABLE runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL CHECK (finished_at >= started_at),
  result text NOT NULL CHECK (result IN ('ok', 'failed', 'not_configured')),
  -- [{ "kind": "database" | "data", "key", "bytes", "sha256" }], one per uploaded object.
  objects jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(objects) = 'array'),
  -- The encrypted bytes uploaded in this run.
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  error_code text CHECK (char_length(error_code) <= 64),
  error_message text CHECK (char_length(error_message) <= 500),
  CHECK ((result = 'failed') = (error_code IS NOT NULL))
);

CREATE INDEX runs_started_at_idx ON runs (started_at DESC);
CREATE INDEX runs_ok_started_at_idx ON runs (started_at DESC) WHERE result = 'ok';
