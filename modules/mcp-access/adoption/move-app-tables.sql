-- Example adoption migration (README §5): an app that ran its own MCP tokens and OAuth tables in
-- `public` moves them into the module's schema, so `migrate` with `baseline: { "mcp-access": 2 }`
-- (or `softure migrate --adopt mcp-access@<version> --through 2`) can adopt files 1 and 2 without
-- running them. Run it as the app's own migration, in its `before` hook, once. It keeps every row:
-- issued tokens, connected assistants and their refresh tokens keep working.
--
-- Assumed app shape: public.access_tokens (id, user_id, name, token_hash, can_write, created_at,
-- expires_at, last_used_at, grant_id), public.oauth_clients, public.oauth_authorization_codes and
-- public.oauth_grants with the module's column names, user_id referencing auth.users. Constraint
-- and index names, column defaults and checks may differ: the script drops the app's and creates
-- the module's. An app without OAuth tables deletes the OAuth part and adopts `--through 1` after
-- dropping its grant_id column (or has none).
-- Rollback: move the tables back with ALTER TABLE mcp.<table> SET SCHEMA public before anything
-- else writes to them.

CREATE SCHEMA IF NOT EXISTS mcp;
ALTER TABLE public.oauth_clients SET SCHEMA mcp;
ALTER TABLE public.oauth_authorization_codes SET SCHEMA mcp;
ALTER TABLE public.oauth_grants SET SCHEMA mcp;
ALTER TABLE public.access_tokens SET SCHEMA mcp;

-- The app's constraints (but the primary keys) and indexes, whatever their names.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT con.conrelid::regclass AS table_name, con.conname
    FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'mcp' AND c.relname IN ('access_tokens', 'oauth_grants', 'oauth_authorization_codes', 'oauth_clients')
      AND con.contype IN ('f', 'u', 'c', 'x')
    ORDER BY con.contype = 'f' DESC
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.table_name, item.conname);
  END LOOP;
  FOR item IN
    SELECT i.relname
    FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class c ON c.oid = x.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'mcp' AND c.relname IN ('access_tokens', 'oauth_grants', 'oauth_authorization_codes', 'oauth_clients') AND NOT x.indisprimary
  LOOP
    EXECUTE format('DROP INDEX mcp.%I', item.relname);
  END LOOP;
END $$;

-- Defaults: the module sets every value itself, ids aside.
ALTER TABLE mcp.access_tokens ALTER COLUMN can_write DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE mcp.oauth_clients ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE mcp.oauth_authorization_codes ALTER COLUMN can_write DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE mcp.oauth_grants ALTER COLUMN can_write DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT;

-- Data the module's checks refuse: names over 60 characters (a client name is also the name of
-- its access tokens) or with outer spaces.
UPDATE mcp.oauth_clients SET client_name = btrim(left(btrim(client_name), 60)) WHERE client_name <> btrim(left(btrim(client_name), 60));
UPDATE mcp.access_tokens SET name = btrim(left(btrim(name), 60)) WHERE name <> btrim(left(btrim(name), 60));
-- Codes live minutes: one the module could not verify (not an S256 challenge) is dropped, and the
-- client starts its authorization again.
DELETE FROM mcp.oauth_authorization_codes WHERE code_challenge !~ '^[A-Za-z0-9_-]{43}$' OR expires_at <= created_at;

-- The module's constraints and indexes (migrations/0001 and 0002), by the names it gives them.
ALTER TABLE mcp.oauth_clients
  ADD CONSTRAINT oauth_clients_client_id_check CHECK (char_length(client_id) BETWEEN 1 AND 255),
  ADD CONSTRAINT oauth_clients_client_name_check CHECK (char_length(client_name) BETWEEN 1 AND 60 AND client_name = btrim(client_name)),
  ADD CONSTRAINT oauth_clients_redirect_uris_check CHECK (jsonb_typeof(redirect_uris) = 'array' AND jsonb_array_length(redirect_uris) BETWEEN 1 AND 10),
  ADD CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK (token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic')),
  ADD CONSTRAINT oauth_clients_client_secret_hash_check CHECK (client_secret_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id),
  ADD CONSTRAINT oauth_clients_secret_matches_method CHECK ((token_endpoint_auth_method = 'none') = (client_secret_hash IS NULL));

ALTER TABLE mcp.oauth_authorization_codes
  ADD CONSTRAINT oauth_authorization_codes_code_hash_check CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT oauth_authorization_codes_client_id_fkey FOREIGN KEY (client_id) REFERENCES mcp.oauth_clients (id) ON DELETE CASCADE,
  ADD CONSTRAINT oauth_authorization_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD CONSTRAINT oauth_authorization_codes_code_challenge_check CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  ADD CONSTRAINT oauth_authorization_codes_check CHECK (expires_at > created_at),
  ADD CONSTRAINT oauth_authorization_codes_code_hash_key UNIQUE (code_hash);
CREATE INDEX oauth_authorization_codes_client_id_idx ON mcp.oauth_authorization_codes (client_id);
CREATE INDEX oauth_authorization_codes_user_id_idx ON mcp.oauth_authorization_codes (user_id);
CREATE INDEX oauth_authorization_codes_expires_at_idx ON mcp.oauth_authorization_codes (expires_at);

ALTER TABLE mcp.oauth_grants
  ADD CONSTRAINT oauth_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD CONSTRAINT oauth_grants_client_id_fkey FOREIGN KEY (client_id) REFERENCES mcp.oauth_clients (id) ON DELETE CASCADE,
  ADD CONSTRAINT oauth_grants_refresh_token_hash_check CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT oauth_grants_previous_refresh_token_hash_check CHECK (previous_refresh_token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT oauth_grants_refresh_token_hash_key UNIQUE (refresh_token_hash),
  ADD CONSTRAINT oauth_grants_user_id_client_id_key UNIQUE (user_id, client_id);
CREATE INDEX oauth_grants_client_id_idx ON mcp.oauth_grants (client_id);
CREATE INDEX oauth_grants_previous_refresh_token_hash_idx ON mcp.oauth_grants (previous_refresh_token_hash);
CREATE INDEX oauth_grants_refresh_expires_at_idx ON mcp.oauth_grants (refresh_expires_at);

ALTER TABLE mcp.access_tokens
  ADD CONSTRAINT access_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD CONSTRAINT access_tokens_name_check CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name)),
  ADD CONSTRAINT access_tokens_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT access_tokens_check CHECK (expires_at > created_at),
  ADD CONSTRAINT access_tokens_token_hash_key UNIQUE (token_hash),
  ADD CONSTRAINT access_tokens_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES mcp.oauth_grants (id) ON DELETE CASCADE;
CREATE INDEX access_tokens_user_id_created_at_idx ON mcp.access_tokens (user_id, created_at DESC);
CREATE INDEX access_tokens_expires_at_idx ON mcp.access_tokens (expires_at);
CREATE INDEX access_tokens_grant_id_idx ON mcp.access_tokens (grant_id);
