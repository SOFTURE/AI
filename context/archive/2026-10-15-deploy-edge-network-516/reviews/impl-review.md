---
change_id: deploy-edge-network-516
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: deploy-edge-network-516

Checked the branch diff against plan.md, reviews/plan-review.md and issue #516.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Two header comments of `deploy.sh.tmpl` grew past 120 characters a line. | Fixed: reflowed. |
| 2 | Check | `--remove-orphans` with `--edge`: the other stack's containers belong to another compose project, so they are never orphans here; an app moving from its own Traefik to `--edge` has its old `traefik` container removed on the first switch, which is wanted. | No change. |
| 3 | Check | Labels are double-quoted YAML: the rule's backticks need no escape, `\\.` becomes `\.` as in `traefik.yml`, and `$${1}` reaches Traefik as `${1}` (compose interpolation). Covered by the parsed-label test. | No change. |
| 4 | Check | The health step keeps working under bash 3.2 (`${headers[@]+…}` for the empty array, the regex held in a variable); the test runs it with the system bash and a stub curl. | No change. |
| 5 | Check | Without `--edge` and without a worker, every generated file is byte-identical to master's: the switch value renders `traefik app`, the new sections render nothing. Covered by the existing tests, unchanged but for one header-line assertion. | No change. |
| 6 | Warning | The committed e2e app (`tools/deploy/e2e/app`) is what init writes, and its drift test failed on the reflowed `deploy.sh` comments. | Fixed: regenerated with `npm run e2e-app -w @softure-ai/deploy`. |

No Critical findings.
