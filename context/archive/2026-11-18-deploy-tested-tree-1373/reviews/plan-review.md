# Plan review: deploy-tested-tree (#1373)

Verdict: approve.

- The answer is conservative by construction: only equal trees and green named checks give `"true"`; every API,
  parsing or ancestry doubt gives `"false"`, so the worst case is today's behaviour.
- A separate workflow keeps `deploy-release-checks.yml` at `contents: read`, as the issue asks.
- Risk: the fail-fast pipeline's `build` must not run when a needed job was skipped because of a failure; its `if`
  names every needed result explicitly, and the example test pins it.
- Risk: bash 3.2 on macOS; the script uses `[[ == ]]` globbing, `read -r`, `awk` with `ENVIRON`, `sort`, no arrays
  beyond plain variables.
