# Plan review: release-batch-3

Reviewed: plan.md @ 2026-10-13. Mode: light. Verdict: ready.
Findings: 0 critical, 1 warning, 0 suggestion.
Grounding: `scripts/release/version.mjs` (refuses a bump whose new version a dependent's range rejects),
`foundation/core/src/config.ts` (checks `dependsOn` ranges at runtime), the batch-2 implementation review (raising a
range before its bump makes `npm install` look for an unpublished version), PR #433.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (twenty bumps, ranges, manifests, workflow defaults, release, `npm view`) |
| Slicing | PASS (widen, bump, then require: each step keeps the workspace linked) |
| Verifiability | PASS (repository tests, e2e example app, `npm view`) |
| Data and migrations | PASS (none) |
| Security | PASS (no entry point) |
| Scope | PASS (no open pull request touches these packages) |

## Findings
- warning: `dependsOn` ranges are a runtime check, not covered by `release:version`. Phase 3 must move them, or an
  app on the new versions fails `defineSoftureConfig`. Covered by phase 3 step 1.

## Decisions (auto)
- none beyond change.md.
