# Implementation review: blog-indexnow-job

Reviewed: commits c62e96c..HEAD against plan.md. Mode: full. Verdict: ready.
Findings: 0 critical, 0 warning, 2 notes.

## Coverage
| Ask of #493 | Where |
| --- | --- |
| 1. `blog.indexnow` handler, enqueue after a committed publish, payload = changed paths | `src/jobs/{handler,enqueue,payload}.ts`; CLI `queueIndexNow` in `src/cli/run.ts` (after commit and refresh) |
| 1. retry on network errors, 5xx and 429; `failJob` on other 4xx | `classifyFailure` in `src/jobs/handler.ts`; tests: unreachable → 503 → 200, 429 with and without `Retry-After`, 400/403/422 |
| 2. dedup key per run | `indexnow:<sha256 of sorted paths>`; tests: second enqueue and a second CLI run return the pending job |
| 3. sync path kept, jobs an optional peer, "queued" in the CLI report | detection in `src/jobs/queue.ts` (no jobs import), dynamic import from the CLI; architecture test; text and line reporters |
| 4. README and CHANGELOG | README "The IndexNow submit as a job", CLI bullet, line contract; CHANGELOG Unreleased with the opt-in steps |

## Notes
- `@softure-ai/jobs` reached 0.1.0 on master (4117981) while this PR was open; the peer range and `dependsOn` were
  tightened to `^0.1.0` when master was merged in. The blog release must follow the jobs publish.
- `BlogIndexNowOutcome` gained `queued` (compile-time break for an exhaustive switch); listed in the CHANGELOG.

## Decisions (auto)
- No changes requested.
