# Plan review: marketing-kit-screenshot-variants

Reviewed: plan.md @ 2026-10-04. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 2 suggestion.
Grounding: 9/9 paths, 6/6 symbols (`takeScreenshots`, `getScreenshotFile`, `screenshotSchema`, `checkUnique`,
`ScreenshotEntry`, `shots` in `cli/main.ts`), 1/1 command (`npm run schema -w @softure-ai/marketing-kit` →
`tsx scripts/write-schema.ts`); Chromium builds for the browser tests are present (`/opt/pw-browsers/chromium-1194`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (scale, scheme pair, gates per file, the Unknown answered) |
| Slicing | PASS (one phase; schema, capture and CLI only make sense together) |
| Verifiability | PASS (PNG dimensions from IHDR; scheme proven by the phrase gate on `motion.html`) |
| Data and migrations | PASS (none) |
| Tests | WARN (W1) |
| Security | PASS (local config file and a local browser; no entry point) |
| Lean | PASS |
| Fit | PASS after S1 |
| Cost and defaults | PASS (no default changes the output of an existing config) |
| Scope | PASS (FU-19, recording and OG excluded) |
| Reuse | PASS (one naming helper for capture and schema) |
| Lessons | PASS (no lazy regexes over CSS: none added) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The existing config-defaults test changes
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 1
**Problem:** `tests/config.test.ts:242` expects the parsed entry with `toEqual`; the new `scale` default adds a key,
so the test fails unless updated, and the plan lists only new cases there.
**Fix:** update that expectation to include `scale: 1` (and no `colorSchemes`), which also covers "defaults load".
**Decision:** Fix now (it is the defaults case step 1 asks for).

### S1 [SUGGESTION] `shots <id>` selects an entry, not a file
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, steps 3 and 5
**Problem:** with a pair, a user may try `shots hero-dark`; the CLI selects by entry id and would answer "no screenshot".
**Fix:** say in the README that `shots <id>` takes the entry's id and writes all of its files.
**Decision:** Fix now (one sentence in step 5).

### S2 [SUGGESTION] Very large captures at scale 4
**Effort:** medium. **Lens:** Cost. **Where:** schema bounds
**Problem:** 8000 px × scale 4 is a 32000 px wide image; Chromium may fail such a capture with an error that
propagates as a crash instead of a gate.
**Fix:** a bound on `width × scale`; the real limit depends on the GPU and the page height, so any fixed number is a guess.
**Decision:** Accept: the same bounds hold for the recording device today; a store-listing or landing capture is far
below them, and the error still names the operation.

## Triage summary
Fixed: W1, S1. Accepted: S2. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W1 → Fix now (cheap, part of the planned defaults case).
- S1 → Fix now (README sentence).
- S2 → Accept (bounds equal the recording's; a fixed limit would be a guess).
