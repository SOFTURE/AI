---
change_id: deploy-ops-local-run
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: deploy-ops-local-run

Reviewed: the branch diff against plan.md, change.md and issue #405.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: the spawn code of `runSsh` moved to `child-process.ts` (`runChild`) so `run --local` shares it; the remote path keeps its argv, refusals and messages (`tests/remote-cli.test.ts` unchanged and green). | No change. |
| 2 | Check | Plan review finding 1: `--local` is only looked for among `run`'s client flags; `--local` after the script name goes to the script, and `report` never sees it. | No change. |
| 3 | Check | Plan review finding 2: `describeDatabaseUrl` prints `host[:port]/database` only, and the variable's name when the value is not a URL (tested). | No change. |
| 4 | Check | Plan review finding 3: the fake ssh uses `cat`, `printf` and `"$@"` only, without `set -u`, so it runs under bash 3.2. | No change. |
| 5 | Info | The fake numbers calls with a counter file, so two calls at the same moment could share a number. Wrappers call ssh one at a time; documented as recording calls in order. | Left as is. |
| 6 | Info | `tsx` is not a dependency: an app that runs its scripts with tsx has it, and `--tsx` names another runner. | Left as is. |

Gates: see plan.md Progress.
