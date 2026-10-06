# Plan review: deploy-workflow-e2e

Reviewed: plan.md against change.md, research.md, `deploy-app.yml`, `tests/repo/deploy-workflows.test.ts`,
`tests/repo/ci-workflows.test.ts` and lessons. Mode: autonomous (`--auto`), every finding decided by the reviewer.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Critical | The deploy job's `concurrency` group is `deploy-app-<repository>-<environment>` with `cancel-in-progress: false`. GitHub keeps one running and one pending run per group and a new pending one cancels the old pending one, so two pull requests running the e2e at once would cancel each other's deploy job. | Accepted: on the test path the group gets `-e2e-<run id>`; production groups are unchanged. |
| P2 | Critical | Alpine's `adduser -D` leaves the account locked (`!` in `/etc/shadow`); sshd without PAM refuses any login to a locked account, keys included, so the test would fail on authentication with a misleading message. | Accepted: the entrypoint sets the password field to `*` (no password, not locked). |
| P3 | Warning | `start-server.sh` must not report the server ready before sshd listens, and the deploy workflow's own test forbids `ssh-keyscan` in its scripts. | Accepted: wait for the `SSH-` banner on the port through bash's `/dev/tcp`, at most 60 s, and print the container log on a timeout. |
| P4 | Warning | Mounting the whole key folder into the container would put the client's private key on the server's side. | Accepted: the container mounts only `server/` (host key, the authorized line) and `received/`; the client key stays outside. |
| P5 | Warning | `tests/repo/deploy-workflows.test.ts` treats every `deploy-*.yml` as a reusable workflow ("triggered only by workflow_call"), so the caller cannot be named `deploy-e2e.yml`. | Accepted: the caller is `e2e-deploy.yml`. |
| P6 | Warning | `download-artifact` must match the repository's pin (`release.yml` uses v8 with `upload-artifact` v7). | Accepted: v8 in the caller, v7 for the upload. |
| P7 | Suggestion | The committed init output will drift when DF-8 changes the `deploy.sh` template. | Accepted (already in the plan): the drift test names the script; noted for DF-8 in the hand-off to the coordinator. |
| P8 | Suggestion | `npm ci` in the full checkout runs `prepare` (lefthook). | No change: `prepare` exits early when `CI` is set, and runners set it. |

No open blocking findings. Plan updated (P1 to P6).
