-- The app's stored files: one row per file, its bytes in the configured storage under `storage_key`. A deleted or
-- expired file keeps its row until `pruneFiles` has removed its bytes, so nothing is left behind in storage.
-- Rollback: DROP TABLE files.files; then DELETE FROM softure.migrations WHERE module = 'files' AND version = 1;
--   (the objects in storage are not touched by a rollback).
CREATE TABLE files (
  id uuid PRIMARY KEY,
  -- The account the file belongs to. No foreign key: the module works with any account store.
  owner_id text NOT NULL CHECK (char_length(owner_id) BETWEEN 1 AND 200),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size bigint NOT NULL CHECK (size >= 0),
  -- A media type with optional parameters, printable ASCII only (it is sent back as a header).
  content_type text NOT NULL CHECK (content_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*(;[ -~]*)?$' AND char_length(content_type) <= 255),
  -- The sanitised name: no slash, backslash or control character.
  original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 255 AND original_name !~ '[/\\[:cntrl:]]'),
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_-]{0,31}$'),
  storage_key text NOT NULL CHECK (storage_key ~ '^[a-z0-9][a-z0-9/-]{0,199}$'),
  -- Bumped by revokeFileLinks: a link signed for an older generation stops working.
  link_generation integer NOT NULL DEFAULT 1 CHECK (link_generation >= 1),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  CONSTRAINT files_storage_key_key UNIQUE (storage_key),
  CONSTRAINT files_expiry_check CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- An owner's live files, newest first (listFiles, the quota sum, the privacy export).
CREATE INDEX files_owner_created_idx ON files (owner_id, created_at DESC) WHERE deleted_at IS NULL;
-- Dedupe: an owner's live file with a given hash.
CREATE INDEX files_owner_sha256_idx ON files (owner_id, sha256) WHERE deleted_at IS NULL;
-- Prune: files whose time is up, and files deleted but not yet removed from storage.
CREATE INDEX files_expires_at_idx ON files (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX files_deleted_at_idx ON files (deleted_at) WHERE deleted_at IS NOT NULL;
