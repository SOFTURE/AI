---
change_id: macos-test-portability
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: macos-test-portability

Checked `plan.md` against `change.md`, the issue, the check, pack and send steps of `deploy-app.yml`, the e2e
scripts (`check-received.sh`, `server/record.sh`), the tests that run them and `ci.yml` with its repository test.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The macOS runner image installs Homebrew's bash 5 ahead of `/bin`, so a job that just runs the tests would pass with bash 5 and miss exactly the bash 3.2 regressions it is meant to catch. | Accepted: D6 puts `/usr/bin:/bin` first and prints the versions. |
| 2 | Warning | `comm` without `--nocheck-order` complains on unsorted input (GNU exits 1, which `set -e` turns into an abort inside the command substitution). `record.sh` sorts, but the received list is input from the server. | Accepted: D4 sorts it before `comm`. |
| 3 | Suggestion | `record.sh` reads modes with `awk '{ print $1 }'` from `tar -tv`, which is the first column in both listing formats; `sha256sum` exists on recent macOS (the issue's run passed the recorder test). | No change. |
| 4 | Suggestion | An empty array expands with an "unbound variable" error under `set -u` in bash 3.2. | D3 keeps the owner-flags array non-empty; no other array is added. |
| 5 | Suggestion | The mailing and ops failures of the issue are not shell related and did not reproduce; guessing at a fix would change code with no failing test behind it. | Kept as Manual 1.5 for the owner's Mac. |

No finding blocks the plan.
