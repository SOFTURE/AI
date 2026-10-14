# Plan review: jobs-module

Reviewed: plan.md @ 2026-10-14. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning, 2 suggestions.
Grounding: module shape checked against `modules/security`; `openCommandDatabase`, `createTestDatabase`, `defineModule`
(`health`, `migrations`) and `getModule` exist as named; init's `readAppFacts`, `TEMPLATE_FILES` and the image
`HEALTHCHECK` confirmed in `tools/deploy`.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: every ask of #471 maps to a phase (config + schema P1, enqueue P2, worker P3, test helpers P2, deploy template P4) |
| Grounding | PASS |
| Scope | PASS: billing, mailing, blog stay follow-ups |
| Risk | WARN (below) |
| Testability | PASS |

## Findings
- WARNING: the image's `HEALTHCHECK` probes port 3000; a worker container started from the same image would turn
  unhealthy and fail `docker compose up --wait`. Phase 4 must disable the health check on the `worker` service and a
  test must assert it. Accepted into Phase 4.
- SUGGESTION: the worker must open its pool with room for its concurrency (sum of queue concurrencies plus one for
  the claim and heartbeat). Accepted into Phase 3.
- SUGGESTION: state in the README that handlers run at least once. Accepted into Phase 5.

## Decisions (auto)
- Warning and suggestions folded into the phases; no re-plan needed.
