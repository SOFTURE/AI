-- Least-privilege database roles for a SOFTURE app (recipe of @softure-ai/ops).
--
-- Why two roles: `POSTGRES_USER` of the postgres image is the cluster owner and a superuser
-- (`select rolsuper from pg_roles` says so), so an app connecting as it turns a leaked
-- DATABASE_URL into control of the whole server.
--
--   softure_migrator  runs `softure migrate`: CONNECT and CREATE on this database (module schemas
--                     and the `softure` ledger), USAGE and CREATE on `public`. Owns what it creates.
--   softure_app       the app's DATABASE_URL: CONNECT, USAGE on the schemas the migrator creates,
--                     SELECT, INSERT, UPDATE, DELETE on their tables, USAGE and SELECT on their
--                     sequences. No DDL, no TRUNCATE, no other database, no roles. Migration
--                     ledgers (SOFTURE_LEDGER_SCHEMAS) stay read-only for it.
--
-- How it runs: the postgres image executes `/docker-entrypoint-initdb.d/*.sql` once, when it
-- initialises an empty data folder, with `psql -v ON_ERROR_STOP=1`. On an existing volume it never
-- runs: run it by hand, then `existing-database.sql` in this folder's parent. Running it again is
-- safe: a role that exists is kept as it is (password and attributes untouched), so
-- SOFTURE_MIGRATOR_ROLE may name a role the app already migrates with.
--
-- Environment (on the postgres container):
--   SOFTURE_MIGRATOR_PASSWORD, SOFTURE_APP_PASSWORD  required for a role this file creates
--   SOFTURE_MIGRATOR_ROLE, SOFTURE_APP_ROLE          default softure_migrator, softure_app
--   SOFTURE_LEDGER_SCHEMAS                           default softure,drizzle: schemas whose tables
--                                                    the app role may read but never write
--   POSTGRES_DB                                      set by the image
-- Values come in through `\set` with a shell backtick: the entrypoint does not pass the
-- environment as psql variables, and a `:"POSTGRES_DB"` without the `\set` fails with a syntax
-- error after the role was already created.
--
-- Rollback: DROP EVENT TRIGGER softure_ledgers_read_only; DROP FUNCTION
-- public.softure_keep_ledgers_read_only(); DROP OWNED BY softure_app; DROP ROLE softure_app; then
-- the same for softure_migrator after its schemas were dropped or reassigned (REASSIGN OWNED BY
-- softure_migrator TO postgres).

\set migrator_role `echo "${SOFTURE_MIGRATOR_ROLE:-softure_migrator}"`
\set migrator_password `echo "${SOFTURE_MIGRATOR_PASSWORD:-}"`
\set app_role `echo "${SOFTURE_APP_ROLE:-softure_app}"`
\set app_password `echo "${SOFTURE_APP_PASSWORD:-}"`
\set ledger_schemas `echo "${SOFTURE_LEDGER_SCHEMAS:-softure,drizzle}"`
\set database `echo "${POSTGRES_DB:-postgres}"`

SELECT
  NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_role') AS softure_create_migrator,
  NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') AS softure_create_app
\gset

-- An empty password would create a role nobody can log in as, or one that trusts the network.
SELECT (:'softure_create_migrator'::boolean AND :'migrator_password' = '')
    OR (:'softure_create_app'::boolean AND :'app_password' = '')
  AS softure_password_missing \gset
\if :softure_password_missing
  DO $$ BEGIN RAISE EXCEPTION 'SOFTURE_MIGRATOR_PASSWORD and SOFTURE_APP_PASSWORD must be set for the roles this file creates'; END $$;
\endif

\if :softure_create_migrator
  CREATE ROLE :"migrator_role" LOGIN PASSWORD :'migrator_password';
\else
  \echo 'keeping the existing role' :migrator_role 'as the migrator'
\endif
\if :softure_create_app
  CREATE ROLE :"app_role" LOGIN PASSWORD :'app_password';
\else
  \echo 'keeping the existing role' :app_role 'as the app role'
\endif

-- CREATE on the database, not only on `public`: the migrator creates one schema per module and
-- the `softure` ledger schema (found on a first deploy).
GRANT CONNECT, CREATE ON DATABASE :"database" TO :"migrator_role";
GRANT CONNECT ON DATABASE :"database" TO :"app_role";

-- Postgres 15+ no longer lets everyone create in `public`; module migrations may create
-- extensions or helpers there.
GRANT USAGE, CREATE ON SCHEMA public TO :"migrator_role";
GRANT USAGE ON SCHEMA public TO :"app_role";

-- Everything the migrator creates from now on is usable by the app, row by row and no more.
-- Without these, the first query after a deploy would fail on a table the app cannot read.
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" GRANT USAGE ON SCHEMAS TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";

-- ...except a migration ledger: a leaked app URL must not be able to mark a migration as applied
-- (or forget one). Default privileges cannot leave out one schema, so an event trigger takes the
-- write privileges back from every table created in a ledger schema, right after its CREATE TABLE.
-- The function runs as the role that created the table (its owner, who granted the defaults), so
-- it needs no SECURITY DEFINER; revoking what the app role does not hold is only a warning.
SELECT set_config('softure.app_role', :'app_role', false) AS softure_app_role_setting,
  set_config('softure.ledger_schemas', :'ledger_schemas', false) AS softure_ledger_setting \gset
DO $$
BEGIN
  EXECUTE format($function$
    CREATE OR REPLACE FUNCTION public.softure_keep_ledgers_read_only() RETURNS event_trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $body$
    DECLARE
      created record;
    BEGIN
      FOR created IN
        SELECT object_identity FROM pg_event_trigger_ddl_commands()
        WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') AND object_type = 'table'
          AND schema_name = ANY (%L::text[])
      LOOP
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE %%s FROM %%I', created.object_identity, %L);
      END LOOP;
    END
    $body$
  $function$, string_to_array(current_setting('softure.ledger_schemas'), ','), current_setting('softure.app_role'));
END $$;
DROP EVENT TRIGGER IF EXISTS softure_ledgers_read_only;
CREATE EVENT TRIGGER softure_ledgers_read_only ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.softure_keep_ledgers_read_only();
