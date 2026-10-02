-- Moves an existing SOFTURE database onto the least-privilege roles (recipe of @softure-ai/ops).
--
-- For a database whose module schemas were migrated by a superuser (the image's POSTGRES_USER)
-- before the roles existed. `initdb/01-roles.sql` runs only on an empty cluster, and its default
-- privileges cover only what the migrator creates afterwards, so without this file the app role
-- could not read a single existing table.
--
-- Run it as the superuser, after `initdb/01-roles.sql` was run by hand on the same database (same
-- environment variables), and before the app switches its DATABASE_URL to the app role:
--
--   psql -v ON_ERROR_STOP=1 -U postgres -d <database> -f initdb/01-roles.sql
--   psql -v ON_ERROR_STOP=1 -U postgres -d <database> -f existing-database.sql
--
-- What it does, in one transaction, for every schema except `public` and the system schemas (the
-- module schemas and the `softure` ledger): the migrator becomes the owner of the schema and of its
-- tables, views, standalone sequences, functions and types, so later migrations can alter them;
-- the app role gets USAGE on the schema and row privileges on its tables and sequences. Tables of
-- the app itself in `public` get the row privileges but keep their owner: they belong to the app's
-- own migration tool.
--
-- Rollback: ALTER SCHEMA ... OWNER TO postgres (and the same per object), then
-- REVOKE ALL ON ALL TABLES IN SCHEMA ... FROM softure_app, per schema.

\set migrator_role `echo "${SOFTURE_MIGRATOR_ROLE:-softure_migrator}"`
\set app_role `echo "${SOFTURE_APP_ROLE:-softure_app}"`

BEGIN;

-- psql variables do not reach inside a DO body; transaction-local settings do.
SELECT set_config('softure.migrator_role', :'migrator_role', true), set_config('softure.app_role', :'app_role', true);

DO $$
DECLARE
  migrator text := current_setting('softure.migrator_role');
  app text := current_setting('softure.app_role');
  module_schema record;
  target record;
BEGIN
  FOR module_schema IN
    SELECT oid, nspname FROM pg_namespace
    WHERE nspname NOT IN ('public', 'information_schema') AND nspname NOT LIKE 'pg\_%'
  LOOP
    EXECUTE format('ALTER SCHEMA %I OWNER TO %I', module_schema.nspname, migrator);

    -- Tables, views and materialized views; a table's identity and serial sequences follow it.
    FOR target IN
      SELECT format('%s %I.%I', CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
                    n.nspname, c.relname) AS object
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relnamespace = module_schema.oid AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND NOT c.relispartition
    LOOP
      EXECUTE format('ALTER %s OWNER TO %I', target.object, migrator);
    END LOOP;
  END LOOP;

  -- Standalone sequences (not owned by a table column) and routines, in the same schemas.
  FOR target IN
    SELECT format('SEQUENCE %I.%I', n.nspname, c.relname) AS object
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND n.nspname NOT IN ('public', 'information_schema') AND n.nspname NOT LIKE 'pg\_%'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i'))
    UNION ALL
    SELECT format('ROUTINE %s', p.oid::regprocedure)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('public', 'information_schema') AND n.nspname NOT LIKE 'pg\_%'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    UNION ALL
    SELECT format('TYPE %I.%I', n.nspname, t.typname)
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype IN ('e', 'd', 'r', 'm') AND n.nspname NOT IN ('public', 'information_schema') AND n.nspname NOT LIKE 'pg\_%'
  LOOP
    EXECUTE format('ALTER %s OWNER TO %I', target.object, migrator);
  END LOOP;

  FOR module_schema IN
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT IN ('information_schema') AND nspname NOT LIKE 'pg\_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', module_schema.nspname, app);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', module_schema.nspname, app);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', module_schema.nspname, app);
  END LOOP;
END $$;

COMMIT;
