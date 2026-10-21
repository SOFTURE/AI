-- Sync state of jobs that poll third-party sources: a cursor per source and a ledger of the items already handled.
-- Rollback: DROP TABLE jobs.sync_items; DROP TABLE jobs.sync_cursors; then
--   DELETE FROM softure.migrations WHERE module = 'jobs' AND version = 4;
CREATE TABLE sync_cursors (
  -- The source, named by the app: `gmail.inbox`, `todoist:project-42`.
  source text PRIMARY KEY CHECK (source ~ '^[a-z][a-z0-9_.:-]{0,126}$'),
  -- Where the next read starts: a timestamp, a history id, a page token. Moved only by a compare-and-set.
  cursor text NOT NULL CHECK (char_length(cursor) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE sync_items (
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9_.:-]{0,126}$'),
  -- The item's id at the source.
  item_id text NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 500),
  -- pending: seen, not handled yet (a failed attempt with attempts left); the rest are final.
  status text NOT NULL CHECK (status IN ('pending', 'done', 'skipped', 'failed')),
  -- The code of the last failed attempt, or why the item was skipped; never a message.
  error_code text CHECK (char_length(error_code) BETWEEN 1 AND 200),
  attempts integer NOT NULL CHECK (attempts BETWEEN 0 AND 1000),
  -- What handling the item produced in the app (a task id, a mail id), for the overview.
  result_ref text CHECK (char_length(result_ref) BETWEEN 1 AND 500),
  first_seen_at timestamptz NOT NULL,
  -- The last time a run met the item; pruning goes by it, so an item the source still returns is never forgotten.
  last_seen_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  finished_at timestamptz,
  PRIMARY KEY (source, item_id),
  CHECK ((status <> 'pending') = (finished_at IS NOT NULL)),
  CHECK (status <> 'failed' OR (error_code IS NOT NULL AND attempts >= 1)),
  CHECK (status <> 'done' OR attempts >= 1),
  CHECK (result_ref IS NULL OR status = 'done'),
  CHECK (last_seen_at >= first_seen_at)
);

-- The overview lists recent changes, per source or over all of them.
CREATE INDEX sync_items_source_updated_idx ON sync_items (source, updated_at DESC);
CREATE INDEX sync_items_updated_idx ON sync_items (updated_at DESC);
-- Pruning deletes items no run has met for the retention period.
CREATE INDEX sync_items_last_seen_idx ON sync_items (last_seen_at);
