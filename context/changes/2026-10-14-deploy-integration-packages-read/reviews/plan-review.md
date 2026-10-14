# Plan review: deploy-integration-packages-read

Reviewed: plan.md @ 2026-10-14. Mode: light. Verdict: ready.
Findings: 0 critical, 1 warning, 0 suggestions.
Grounding: `deploy-integration.yml` lines 94-104 (test job permissions), `examples/integration.yml` permissions,
`deploy-workflows.test.ts` assertions at the test job and the example caller re-checked against the tree.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Grounding | PASS |
| Scope | PASS (one job's permissions, its caller and docs) |
| Risk | WARN: callers on `@master` that grant no `packages` scope are refused at start after the merge |

## Findings
- **Warning (risk).** The workflows are called at `@master`, so the new scope applies to every caller on merge. A
  caller copied from the old example (`contents: write` only) must add `packages: read`. Accepted: the issue asks for
  exactly this grant, there is no way to read a private package without it, and the changelog and the merge report
  name the one-line caller change.

## Decisions (auto)
- Accept the caller change rather than a conditional scope: GitHub permissions take no expressions.
