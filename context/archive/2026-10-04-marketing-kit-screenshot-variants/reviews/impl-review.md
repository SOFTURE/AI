# Implementation review: marketing-kit-screenshot-variants

Scope: full · Date: 2026-10-04 · Commits: 5ecdc74..6f3c840 · Gates: typecheck ✓ lint ✓ test ✓ (2409 tests, 12 skipped) · build ✓

## Verdict
Ready. A `screenshots[]` entry takes `scale` (1-4, default 1) and `colorSchemes`; each listed scheme is captured into
`<id>-<scheme>.png` in its own browser context with `deviceScaleFactor`, and passes the status, phrase and size gates
alone. Entries without the new keys write `<id>.png` exactly as before (the fixture CLI test is unchanged). One
warning found and fixed in this review (F1), two suggestions accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS after fix | F1 |
| Tests | PASS | - |
| Security | PASS (local config and browser, no entry point, no secrets) | - |
| Patterns and lessons | PASS | F2, F3 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Scale and colour schemes per screenshot | c145b56, 6f3c840 | yes | helper location and the stricter name check recorded in plan.md `## Decisions (auto)` |

Files: planned and changed 9 · unplanned 1 (`src/config/screenshot-names.ts`, the shared naming helper) · planned, not changed 0.

## Findings

### F1 [WARNING] An entry could delete another entry's fresh file
**Impact:** MEDIUM · **Dimension:** Correctness · **Where:** `src/screenshot/screenshot.ts` (`removeEntryFiles`), `src/config/schema.ts`
**What:** the capture removes `<id>.png`, `<id>-light.png` and `<id>-dark.png` before an entry runs, but the first
version of the name check compared only the files of the current lists. Entries `hero` and `hero-light` (no lists)
passed the check, and `hero` would remove `hero-light.png` written moments earlier.
**Fix:** the check compares every name an id may write (`getScreenshotNames(id)`), the same list the removal uses;
test "an id that is another entry's scheme file, even without scheme lists".
**Decision:** fixed (6f3c840).

### F2 [SUGGESTION] The CLI summary counts entries, not files
**Impact:** LOW · **Dimension:** Patterns · **Where:** `src/cli/main.ts` (`screenshots: N from ...`)
**What:** with a pair, "screenshots: 1" precedes two `✓` lines; the final failure line counts files.
**Decision:** accept (auto): each file still gets its own line, and the summary names what was selected.

### F3 [SUGGESTION] Large captures at scale 4 (plan review S2)
**Impact:** LOW · **Dimension:** Patterns · **Where:** `screenshotSchema.scale`
**Decision:** accept (auto), as in the plan review: bounds equal the recording device's; a fixed pixel limit would be a guess.

## Progress audit
- 1.1: `screenshot.test.ts` › "screenshot shots" (2), "captures at the entry's device scale" (1600×1200 from IHDR),
  "captures and gates each listed scheme on its own file", "removes the older single file ..."; `config.test.ts` ›
  scale/colorSchemes load and six refusals by path; `shots-cli.test.ts` › "writes a light and a dark file at the
  entry's device scale" (2560 px wide each). All ran with `PLAYWRIGHT_CHROMIUM_PATH`, none skipped.
- 1.2: `tests/schema.test.ts` green on the regenerated `schema/marketing.schema.json`.
- 1.3: typecheck, lint (ESLint and language gate), full `npm test` and `npm run build` re-run in this session.
- 1.4: agent check of a fixture pair at scale 2 (see plan.md); scheme per file proven by the automated test.
