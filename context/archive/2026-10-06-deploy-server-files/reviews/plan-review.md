# Plan review: deploy-server-files

Date: 2026-10-06 · Verdict: approved with changes (W2 and S1 taken into Phase 1)

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | compose folder, `deploy.sh` and `deploy.json` ship with `.env.prod` in the one SSH call; `deploy.sh` unpacks into a release folder before the switch |
| Scope | PASS | workflow, server template, their tests, README, version; `row-counts` and the schema left to DF-5 and DF-8, the live run to DF-3 |
| Unknowns answered | PASS | the shipped folder is the compose file's; FIRE's gateway recorded for DF-1 |
| Security | PASS | archive listed before extraction (files and folders only, narrow names, no `..`), size capped, owner not kept; `.env.prod` never left in the release folder; workflow values through `env:`; checkout stays anchored and credential-free |
| Testability | PASS | both halves run together in a test with a stubbed `docker`; repository test for the workflow shape; actionlint and shellcheck |
| Conventions | PASS | the existing check/env/sparse patterns; English only |

Findings:

- **W1 (warning, accepted):** shipping `deploy.sh` lets whoever holds the deploy key replace the server script. It
  widens nothing: that key already picks the image and its environment, and the deploy user runs Docker, which is
  root-equivalent on the host. The README says so.
- **W2 (warning, taken):** the files are installed before the backup and the schema guard, so after a refusal the
  server holds the new files while the old containers keep running. The messages "nothing changed" would be wrong;
  they become "nothing was restarted", and the README says a rollback redeploys the older tag, which installs its own
  files.
- **W3 (warning, accepted):** a server that runs an older `deploy.sh` would take the archive for `.env.prod`. No app
  deploys through the workflow yet, so the protocol changes without a fallback; the README tells an app whose
  `deploy.sh` came from 0.1.2 or earlier (published while this ran) to copy the new one once.
- **S1 (suggestion, taken):** check the new compose file with `docker compose config --quiet` from the release folder
  before installing anything, so a broken compose file stops the release with nothing installed.
