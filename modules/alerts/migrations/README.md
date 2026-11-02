# Migrations

Plain SQL, forward only: `NNNN_<description>.sql`, each starting with a comment that states the
rollback plan (docs/02-module-standard.md §4). Tables live in the module's own Postgres schema.
