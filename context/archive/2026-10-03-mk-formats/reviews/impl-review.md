# Implementation review: mk-formats

Scope: full · Date: 2026-10-03 · Commits: 6dd2705 (baseline), 8f62900 (phase 1), b8ee00c (phase 2) · Gates:
typecheck ✓ lint ✓ test ✓ (2097 passed, 12 skipped; one `modules/ops` timing test failed once while a render ran
alongside and passed on its own) build ✓ · Render: the fixture film rendered as draft MP4s in 9:16 (1080×1920),
1:1 (1080×1080) and 16:9 (1920×1080) from one recording (Chromium 1194, headless shell 1194).

## Verdict

Ready. `videos[].format` accepts `9:16`, `1:1` and `16:9`. Every layout number lives in `LAYOUTS`
(`src/compose/timeline.ts`); `composeFilm` reads caption, persona and end card from `Geometry` and keeps no
frame px of its own. The 9:16 HTML of the test film is byte-identical to the baseline committed before the
refactor (6dd2705); 1:1 and 16:9 have their own snapshots. No blocking finding.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | F1 |
| Correctness | PASS | F2 |
| Tests | PASS | — |
| Migrations | PASS (none) | — |
| Security | PASS (no new input reaches HTML: layout numbers are constants) | — |
| Patterns and lessons | PASS | F3 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Baseline and geometry table | 6dd2705, 8f62900 | yes | schema regeneration and config tests moved here (F1) |
| 2 Composition, render, contract | b8ee00c | yes | compose, render, CLI, README, index exports, FU-15/FU-16 |

## Findings

### F1 (info): schema and config tests moved from Phase 2 to Phase 1
Adding formats to `VIDEO_FORMATS` turns the schema drift test red, so the JSON regeneration rode with the
enum. Recorded in plan.md Phase 1, step 3. **Decision:** accepted.

### F2 (info): the bezel of the tallest accepted 9:16 phone crosses the frame by 10 px
Pre-existing MK-1 behaviour (`fitsFrame` checks the screen, not the bezel); kept to leave 9:16 unchanged. The
new formats keep the bezel inside the frame (`timeline.test.ts`). **Decision:** no change.

### F3 (info): deferred framings
Desktop 16:9 recording → FU-15; layout overrides in `marketing.json` → FU-16 (followups roadmap, README Limitations).
**Decision:** deferred.

## MK-6 handoff

- `getGeometry(viewport, format = "9:16")`; the recorder keeps the default, camera scales are phone-relative.
- `LAYOUTS` and the layout types are exported from the package entry.
- Snapshots live in `tools/marketing-kit/tests/snapshots/` (not under `src/`, which ships in the npm package).
