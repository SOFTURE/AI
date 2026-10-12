---
change_id: deploy-ops-local-run
reviewed: 2026-10-12
verdict: approved
---

# Plan review: deploy-ops-local-run

Checked plan.md against change.md, research.md, issue #405 and the `run` sources.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `parseCommandLine` is shared with `report`; `--local` must not leak into `report` or change remote refusals. Branch on `--local` in `runRemoteScript` only and keep the remote tests untouched. | Taken into Phase 2. |
| 2 | Warning | Printing the target database must never print the password or user; parse with `URL` and print `host[:port]/database` only, nothing when the value is not a URL. | Taken into Phase 2. |
| 3 | Warning | The fake ssh must not depend on GNU-only flags (`macos` CI job). Use `cat`, `printf` and bash 3.2 arrays only; count calls with a counter file, not `ls | wc`. | Taken into Phase 1. |
| 4 | Check | `./testing` export must follow source, types, default order (`tests/repo/packages.test.ts`). | No change. |
| 5 | Check | `tsx` is not added as a dependency: it runs from the app's `PATH` and `--tsx` overrides; a missing runner is one error line. | No change. |

No Critical findings.
