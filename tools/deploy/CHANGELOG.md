# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/deploy`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`deploy@x.y.z`).

## Unreleased

- `deploy-app.yml`'s check and pack steps also run with bash 3.2 and bsdtar (macOS, where the tests run them); on the
  runner they behave as before.

## 0.1.3

- `init`'s Dockerfile keeps drizzle's driver adapters external in the migrate bundle, so an app that installs one
  database driver only starts `migrate.mjs`.
- On a host without Node, `init`'s `deploy.sh` runs the database steps in a helper image (`softure-deploy-tools:<version>-pg<major>`).
- Each release ships the server files with `.env.prod` in one archive; `deploy.sh` restores files when a release fails before the switch, prints step and result lines, and answers `status` and `maintain` (daily backup retention and image cleanup).
- `backup --exclude-table-data` and `--max-age-days`, and a refused dump without its header.
- `row-counts` reads its tables from `deploy.json` and counts a table the old schema lacks as absent.
- `verify`: method, body and request headers per route, TLS expiry (`verify.tlsMinDays`), `--origin` against a server reachable around the CDN.
- `release-notes` writes a release body section; `release-report` writes the pipeline status and a deployment row.
- `deploy-app.yml` guards the release branch, takes build arguments and app variables, sends a registry token; `deploy-cut-release.yml` and `deploy-report.yml`; `init` writes the release caller.
- `env render` writes the optional compose names the environment sets.
