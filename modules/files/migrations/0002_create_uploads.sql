-- Upload sessions: a client sends a file in chunks to a signed URL, then `finalizeUpload` turns the chunks into a row
-- of files.files. Each received chunk is an object in storage under `uploads/<id>/<index>`; `received_chunks` lists
-- the indices that arrived whole. The state is derived: finalized once `file_id` is set, expired once `expires_at`
-- has passed, complete once every chunk arrived, open otherwise.
-- Rollback: DROP TABLE files.uploads; then DELETE FROM softure.migrations WHERE module = 'files' AND version = 2;
--   (chunk objects left in storage under uploads/ are not touched by a rollback).
CREATE TABLE uploads (
  id uuid PRIMARY KEY,
  -- The account the upload belongs to. No foreign key: the module works with any account store.
  owner_id text NOT NULL CHECK (char_length(owner_id) BETWEEN 1 AND 200),
  original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 255 AND original_name !~ '[/\\[:cntrl:]]'),
  content_type text NOT NULL CHECK (content_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*(;[ -~]*)?$' AND char_length(content_type) <= 255),
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_-]{0,31}$'),
  -- The declared size; every chunk is `chunk_size` bytes except the last.
  size bigint NOT NULL CHECK (size >= 1),
  -- The declared SHA-256, checked at finalize when given.
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  chunk_size integer NOT NULL CHECK (chunk_size >= 1),
  received_chunks integer[] NOT NULL DEFAULT '{}',
  -- The stored file, once finalized. No foreign key: the file may be deleted while the session is still kept for an
  -- idempotent finalize.
  file_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  finalized_at timestamptz,
  CONSTRAINT uploads_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT uploads_finalized_check CHECK ((file_id IS NULL) = (finalized_at IS NULL))
);

-- An owner's open sessions (the per-owner limit, the privacy export and deletion).
CREATE INDEX uploads_owner_idx ON uploads (owner_id) WHERE file_id IS NULL;
-- Prune: sessions whose time is up.
CREATE INDEX uploads_expires_at_idx ON uploads (expires_at);
