# Plan review: blog-indexnow-job

Reviewed: plan.md @ 2026-10-14. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: `submitBlogChanges`, `runPublish`, the reporters, `enqueueJob`, `defineJobHandler`, `failJob`,
`retryJobLater`, `runDueJobs`, `listJobs`, `checkInternalRanges` and the architecture test exist as named.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: ask 1 (handler, enqueue, retry rules) P1–P2; ask 2 (dedup) P1; ask 3 (sync path kept, "queued" report) P2; ask 4 (README, CHANGELOG) P3 |
| Grounding | PASS |
| Scope | PASS: blog only |
| Risk | WARN (below) |
| Testability | PASS: PGlite with both modules, `runDueJobs` with a fake fetch |

## Findings
- WARNING: the handler's `fetchImpl` wrapper must not lose seo's own timeout signal when it adds the job's signal;
  join both with `AbortSignal.any`. Accepted into Phase 1.
- SUGGESTION: payload paths should be bounded (seo refuses more than 10 000 URLs) so a bad payload fails at parse,
  not in seo. Accepted into Phase 1.

## Decisions (auto)
- Findings folded into Phase 1; no re-plan needed.
