# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ops`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`ops@x.y.z`).

## Unreleased

- **Behaviour change:** `GET /api/health` fails its `database` check (`ops.database_missing`, 503) when the config has no database, for example when `DATABASE_URL` is unset at run time. An app without a database sets `ops({ requireDatabase: false })` to keep the previous answer.

## 0.1.6

- `recipes/initdb/01-roles.sql` keeps a role that exists (re-runnable; `SOFTURE_MIGRATOR_ROLE` may name the app's own migration role) and installs an event trigger that keeps ledger tables (`SOFTURE_LEDGER_SCHEMAS`, default `softure,drizzle`) read-only for the app role.
- `recipes/existing-database.sql` leaves the app's schemas (`SOFTURE_APP_SCHEMAS`, default `public,drizzle`) to their owner and takes write privileges on ledgers back from the app role.
- Ops scripts: keys listed in `secrets` also come as `--<key>-file=<path>` or `--<key>-file=-` (stdin).
- `GET /api/health` calls `connection()`, so it is dynamic by its own code; `next` is an optional peer.
- The health route and ops scripts use the configured database handle.
