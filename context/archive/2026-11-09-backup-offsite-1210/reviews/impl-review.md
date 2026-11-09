---
change_id: backup-offsite-1210
reviewed: 2026-11-09
verdict: approved
---

# Implementation review: backup-offsite-1210

Checked the diff (`2a137094`, `5c0133ae`, `504afb4a`) against change.md, plan.md and the plan review.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | MinIO, which the issue and the plan named for the integration test, no longer publishes images (Docker Hub `minio/minio`, `minio/mc`: "object not found"). A job pinned to it would fail before any test ran. | Fixed: the job runs SeaweedFS's S3 gateway (`chrislusf/seaweedfs:4.51`, two weeks old) with per-identity `Write:<bucket>` and `Read`/`List` actions, so it also proves that each token stays on its side. Recorded under Decisions (auto). |
| 2 | Warning | `offsite-backup` is a step name of `maintain` but was not a taken hook name: a `deploy.json` hook named so would have printed two lines of that name. | Fixed: added to `BUILT_IN_STEP_NAMES`. |
| 3 | Check | Secrets reach the CLI only in its environment: the upload runs in a subshell that exports the names; the helper image gets `--env NAME` without values, so nothing shows in `ps` or the docker log. Tested for both modes (the docker log and the npx log hold no secret, the stub sees the values). | No change. |
| 4 | Check | Not configured costs one `read_env` and prints `step|offsite-backup|ok|not configured`; no CLI, no network. Tested: no upload call, no env record. | No change. |
| 5 | Check | A failed upload or a CLI crash leaves `offsite_failure`; verify-backup, cleanup and the maintain hooks still run, and the run then ends `result|failed|offsite-backup|…` with the CLI's redacted message. The status row of a failed run is written too. | No change. |
| 6 | Check | Restore never touches an existing database without `--into --overwrite`, and `--overwrite` refuses a missing one; the private key is refused in argv. Covered by the Postgres tests. | No change. |
| 7 | Note | The tools image's tag is `<deploy version>-pg<major>`, and the backup CLI's version is pinned by the deploy template (`TEMPLATE_VERSIONS.backup`), so a new backup version reaches servers only with a deploy release. Intended: one release pins both. | No change. |
| 8 | Note | The weekly verify keeps the private key in a dedicated GitHub Environment if the owner accepts it; the README offers running verify on the owner's machine instead. | No change. |

No Critical findings.
