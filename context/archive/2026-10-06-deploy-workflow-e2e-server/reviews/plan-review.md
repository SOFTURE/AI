# Plan review: deploy-workflow-e2e-server

Reviewed: plan.md against change.md, research.md, `deploy-app.yml`, `e2e-deploy.yml`, DF-9's `deploy.sh`,
`tests/repo/deploy-workflows.test.ts`, `tools/deploy/tests/e2e-scripts.test.ts` and lessons. Mode: autonomous
(`--auto`), every finding decided by the reviewer.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Critical | DF-9's recorder prints `result|ok`, and the send step accepts a release when that line is anywhere in the output. Once `deploy.sh` runs after the recorder, a `deploy.sh` that fails would still pass. | Accepted (already finding 7): the recorder prints nothing to stdout, the forced command sends its log to stderr, and a test pins that the recorder prints no `result|` line. |
| P2 | Critical | With `UsePAM no`, sshd refuses a locked account even for a key, and a runner's user may have a locked password (the same trap as DF-3's Alpine `adduser -D`). | Accepted: `UsePAM yes` (Ubuntu's default); the local run used a `useradd` user, whose password is locked, and logged in. |
| P3 | Warning | The forced command runs in sshd's minimal environment: no setup-node `PATH`, and the CLI version the e2e app pins is unpublished, so `npx` would fail at the backup. | Accepted: the env file carries the Node folder and the CLI path; `server/bin/npx` answers only `@softure-ai/deploy`. |
| P4 | Warning | Traefik renews a stored certificate within 30 days of its end and would then call Let's Encrypt from CI (measured with a 2-day certificate). | Accepted: the site certificate is valid for 90 days. |
| P5 | Warning | Duplicating the verify job's wait loop in the deploy job lets the two drift. | Accepted: a repository test asserts the e2e step's script and env equal the verify job's. |
| P6 | Warning | `start-server.sh` writes paths unquoted into `sshd_config` and the authorized line; a blank or quote would break or widen them. | Accepted: inputs are checked against a plain-path pattern before anything is created (tested). |
| P7 | Suggestion | The compose project's volume created by hand makes `compose up` warn that it was not created by compose. | Accepted: the volume carries compose's project and volume labels. |
| P8 | Suggestion | A second deploy over the first would also exercise the previous-tag path (backup of real data, row counts). | Not now: out of scope in the plan; DF-9's stubbed tests cover those branches. Not recorded as a gap: nothing is broken. |

No open blocking findings. Plan updated (P2, P4, P5, P6, P7 noted in the approach).
