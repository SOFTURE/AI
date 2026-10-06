-- Least-privilege database roles for a SOFTURE app (recipe of @softure-ai/ops).
--
-- Why two roles: `POSTGRES_USER` of the postgres image is the cluster owner and a superuser
-- (`select rolsuper from pg_roles` says so), so an app connecting as it turns a leaked
-- DATABASE_URL into control of the whole server (FIRE_TRACKER docker/initdb/01-app-user.sql).
--
--   softure_migrator  runs `softure migrate`: CONNECT and CREATE on this database (module schemas
--                     and the `softure` ledger), USAGE and CREATE on `public`. Owns what it creates.
--   softure_app       the app's DATABASE_URL: CONNECT, USAGE on the schemas the migrator creates,
--                     SELECT, INSERT, UPDATE, DELETE on their tables, USAGE and SELECT on their
--                     sequences. No DDL, no TRUNCATE, no other database, no roles.
--
-- How it runs: the postgres image executes `/docker-entrypoint-initdb.d/*.sql` once, when it
-- initialises an empty data folder, with `psql -v ON_ERROR_STOP=1`. On an existing volume it never
-- runs: use `existing-database.sql` in this folder's parent instead.
--
-- Environment (on the postgres container): SOFTURE_MIGRATOR_PASSWORD and SOFTURE_APP_PASSWORD
-- (required), SOFTURE_MIGRATOR_ROLE and SOFTURE_APP_ROLE (default softure_migrator, softure_app),
-- POSTGRES_DB (set by the image). Values come in through `\set` with a shell backtick: the
-- entrypoint does not pass the environment as psql variables, and a `:"POSTGRES_DB"` without the
-- `\set` fails with a syntax error after the role was already created (measured in FIRE_TRACKER).
--
-- Rollback: DROP OWNED BY softure_app; DROP ROLE softure_app; then the same for softure_migrator
-- after its schemas were dropped or reassigned (REASSIGN OWNED BY softure_migrator TO postgres).

\set migrator_role `echo "${SOFTURE_MIGRATOR_ROLE:-softure_migrator}"`
\set migrator_password `echo "${SOFTURE_MIGRATOR_PASSWORD:-}"`
\set app_role `echo "${SOFTURE_APP_ROLE:-softure_app}"`
\set app_password `echo "${SOFTURE_APP_PASSWORD:-}"`
\set database `echo "${POSTGRES_DB:-postgres}"`

-- An empty password would create a role nobody can log in as, or one that trusts the network.
SELECT (:'migrator_password' = '' OR :'app_password' = '') AS softure_password_missing \gset
\if :softure_password_missing
  DO $$ BEGIN RAISE EXCEPTION 'SOFTURE_MIGRATOR_PASSWORD and SOFTURE_APP_PASSWORD must both be set'; END $$;
\endif

CREATE ROLE :"migrator_role" LOGIN PASSWORD :'migrator_password';
CREATE ROLE :"app_role" LOGIN PASSWORD :'app_password';

-- CREATE on the database, not only on `public`: the migrator creates one schema per module and
-- the `softure` ledger schema (FIRE_TRACKER found this on its first deploy).
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
