# Plan review: marketing-kit-render-ci

Reviewed: plan.md @ 2026-10-03. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 6/6 paths (`.github/workflows/ci.yml`, `tools/marketing-kit/tests/render.test.ts`, `tools/marketing-kit/README.md`,
`src/render/hyperframes.ts`, `src/record/record.ts`, `vitest.config.mts`), 3/3 commands (`npx hyperframes browser ensure --force`,
`npx hyperframes browser path`, `npx vitest run <file>`; `node_modules/.bin/hyperframes` exists after `npm ci`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS (one phase, one file plus a README line) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 |
| Security | PASS (no secrets; `permissions: contents: read` stays workflow-wide) |
| Lean | PASS (no cache, no artifact upload) |
| Fit | PASS (mirrors the `test` job's steps) |
| Cost and defaults | WARN (W2) |
| Scope | PASS |
| Reuse | PASS (the runner's Chrome, as in `test`) |
| Lessons | PASS (none apply) |
| Progress format | PASS |

## Findings

### W1 [WARNING] A skipped render test would leave the job green
**Effort:** low. **Lens:** Verifiability. **Where:** Approach, Chosen
**Problem:** the test is `describe.runIf(MARKETING_KIT_RENDER === "1")`; if the variable were lost, Vitest reports
"1 skipped" and exits 0, and item 1.1 could only be checked by reading the log.
**Fix:** set `MARKETING_KIT_RENDER` in the same step as the command, and run Vitest with `--reporter=verbose` so the log
names the test with its result.
**Decision:** Fix now (applied).

### W2 [WARNING] The README still describes the render test as local only
**Effort:** low. **Lens:** Coverage. **Where:** Phase 1 files
**Problem:** the plan said "any doc line, if any"; the README Development section (around line 371-382) lists the
command with no word on CI, while the next paragraph says CI runs the screenshot tests.
**Fix:** name the README section and add one sentence.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] Cache the headless shell
**Effort:** medium. **Lens:** Cost. **Where:** Out of scope
**Problem:** each run downloads about 100 MB.
**Fix:** `actions/cache` on `~/.cache/hyperframes` keyed on the hyperframes version.
**Decision:** Dismiss: the download is seconds on GitHub's network, and a cache key must track the hyperframes pin by
hand; `ensure` without `--force` on a cache miss would silently pick the system Chrome.

## Triage summary
Fixed: W1, W2. Accepted: -. Deferred: -. Dismissed: S1. Verdict after triage: ready.

## Decisions (auto)
- W1 skipped test passes → Fix now (cheap, makes 1.1 checkable).
- W2 README line → Fix now.
- S1 cache → Dismiss (cost negligible, adds a trap).
