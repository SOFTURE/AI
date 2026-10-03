# Implementation review: mk-declarative-actions

Scope: full · Date: 2026-10-03 · Commits: 4cbe3e5 (phases 1-3), 83d4694 (master merge, MK-7), 1cf8a01 (F1-F4) ·
Gates: typecheck ✓ lint ✓ test ✓ (2104 passed, 12 skipped before the fixes; marketing-kit 214 passed after) build ✓ ·
Render: `MARKETING_KIT_RENDER=1` fixture test passed before and after the master merge, with the JSON twin's
`log.json` equal to the TS film's.

## Verdict

Ready after fixes. A video can describe its scene as beat `actions` in `marketing.json`; each action calls the
Director method of the same name, and targets are strict locator descriptors. Load-time checks name the JSON path of
every mistake a browser is not needed for, and a failing action names its path while recording, with the screen
guard's exit code 2 kept. `sceneModule` works as before. An independent review pass found no critical issue; its
one warning and three suggestions are fixed in 1cf8a01.

## Baseline

| Check | Result |
| --- | --- |
| Fixture, real Chromium: `fixture-tour` (TS) vs `fixture-tour-actions` (JSON) | `log.json` deep-equal: beats, taps, keys, camera, marks, stills, cues, frame count |
| FIRE `ania-calculator` (read-only clone 58e6c84), JSON translation in the scratchpad | validates (all `until` words, still, marks, checkScreen); 8 beats, 69 actions; Director call trace deep-equal to the TS scene's (85 calls) |
| Unknown 1: conditional waits | none in FIRE; `until` and `hold` cover every wait |
| Unknown 2: a failing locator's JSON path | `videos[i].beats[b].actions[a] (do): …`, test-pinned |

FIRE's app needs Docker Postgres, so FIRE itself was not recorded; equal call traces give equal logs because the
recorder is deterministic for equal calls (research). The FIRE JSON stays out of the repository (Polish copy).

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | F5 |
| Correctness | PASS after fixes | F1, F4 |
| Tests | PASS | — |
| Migrations | PASS (none) | — |
| Security | PASS | — (`fill.input` an identifier, regex flags `imsu`, config is the project's own) |
| Patterns and lessons | PASS after fixes | F2, F3 |

## Findings

### F1 [WARNING] Cross-sentence checks appear only after other errors are fixed
**Where:** `src/config/schema.ts` `checkScene`. **What:** zod skips the video refinement while a sibling has a
blocking error, so `title: 5` plus a wrong `until` word reports the title first.
**Decision:** fixed (1cf8a01) in the docs: the README says the cross-sentence checks run once the rest is valid.

### F2 [SUGGESTION] A union whose branches all fail on type said "Invalid input"
**Where:** `src/config/issues.ts`. **Fix:** `expandUnionIssues` names the types (`target.name: must be string or object`).
**Decision:** fixed (1cf8a01), test added.

### F3 [SUGGESTION] Limits of the action language were not documented
**What:** no chained locators, `getByPlaceholder`/`AltText`/`Title`, role options beyond `name`, regex `testId`;
ranges stricter than TS. **Decision:** fixed (1cf8a01): README lists them and points at `sceneModule`.

### F4 [SUGGESTION] An `until` word error gave no hint about the sentence's words
**Fix:** the message lists the sentence's words as the check splits them. **Decision:** fixed (1cf8a01).

### F5 [SUGGESTION] Recording's strict-mode error read "did not appear"
**What:** a locator matching several elements failed with "did not appear within 5 s". **Fix:** `failLocator` says
it matches more than one element and suggests `nth` (Playwright's message checked in a scratch run).
**Decision:** fixed in 4cbe3e5 (beyond the plan, inside `src/record/`).

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 The contract | 4cbe3e5 | yes | `actions-schema.ts`, `checkScene`, `expandUnionIssues`, `sceneSource` union |
| 2 The interpreter | 4cbe3e5 | yes | `record/actions.ts`, CLI wiring, trace Director in `tests/support/` |
| 3 Fixture, baseline and docs | 4cbe3e5 | yes | `fixture-tour-actions`, render-test log comparison, README "Scene actions", docs/03 |

Phases share a commit (plan review S1): `sceneSource` replaces `sceneModule` in `VideoConfig`, and the pre-commit
typecheck needs the CLI and the interpreter together.
