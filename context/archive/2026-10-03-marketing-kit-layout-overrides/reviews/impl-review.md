# Implementation review: marketing-kit-layout-overrides

Scope: full · Date: 2026-10-03 · Commits: 778dad9..cb8aadb · Gates: typecheck ✓ lint ✓ test ✓ (2329 tests, 25 skipped) · build ✓ · opt-in render ✓

## Verdict
Ready. `marketing.json` takes a per-format `layout` section (caption, persona, end card and its phone pose), validated
against each format's frame with paths to the key to fix; `getGeometry` merges it through `resolveLayout`; the render
passes the film's override. The three existing snapshots are unchanged, and the fixture's 9:16 override composes a film
that differs from the default only in the caption font size (exact test). Three suggestions, all accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | F1 |
| Tests | PASS | - |
| Security | PASS (local config file, no entry point, no secrets) | - |
| Patterns and lessons | PASS | F2, F3 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Layout overrides in the geometry | 0f71705 | yes | - |
| 2: The layout section in marketing.json | cb8aadb | yes | test file placement drift recorded in plan.md `## Decisions (auto)` |

Files: planned and changed 13 · unplanned 2 (`src/film.test.ts`, `src/compose/compose.test.ts`: `layout: {}` on
hand-built films, required by the new field) · planned, not changed 1 (`tests/layout.test.ts`: the test went into
`compose.test.ts`). Context files (change, plan, roadmap, backlog) are workflow bookkeeping.

## Findings

### F1 [SUGGESTION] A box may start at the frame's bottom edge
**Impact:** LOW · **Dimension:** Correctness · **Where:** `tools/marketing-kit/src/config/schema.ts` (`layoutOverrideSchema`, `y`)
**What:** `top` is bounded by the frame height, so `caption.top: 1920` in 9:16 passes and the caption is off screen.
**Why it matters:** a typo shows up only in the preview or the render, not at load. **Evidence:** `max(frame.height)`.
**Fix:** bound `top` by the frame height minus the box's height, which the composition does not know (the text wraps).
**Decision:** accept (auto): the box height depends on the copy, so an exact bound would be a guess; the preview shows
it at once, and values inside the frame are what the roadmap asked for.

### F2 [SUGGESTION] `LayoutOverride` and the zod section are kept in step by hand
**Impact:** LOW · **Dimension:** Patterns · **Where:** `tools/marketing-kit/src/compose/timeline.ts` (`LayoutOverride`), `src/config/schema.ts`
**What:** a key added to the schema but not to `LayoutOverride` and `resolveLayout` would load and be ignored.
**Why it matters:** silent no-op for a project. **Evidence:** `config.ts` assigns the zod output to `LayoutOverride` structurally.
**Fix:** derive the type from the schema, which would make `compose/` import `config/` (the reverse of today's direction).
**Decision:** accept (auto): keeps `compose/` free of the config layer; both lists are short and next to their tests
(`timeline.test.ts` per key, `config.test.ts` per refusal).

### F3 [SUGGESTION] The CLI summary calls `getGeometry` without the override
**Impact:** LOW · **Dimension:** Patterns · **Where:** `tools/marketing-kit/src/cli/main.ts:129`
**What:** reads only `frame`, which no override changes (plan review S1). **Decision:** accept (auto), as planned.

## Progress audit
- 1.1: `timeline.test.ts` › `resolveLayout` (7 cases) and `getGeometry` › "lays out the caption, persona and end card
  from an override" green.
- 1.2: `git diff 778dad9..cb8aadb -- tools/marketing-kit/tests/snapshots` adds only `film-9x16-layout.html`; the 9:16,
  1:1 and 16:9 snapshot tests green.
- 1.3 and 2.4: typecheck, lint (ESLint and language gate), full `npm test` and `npm run build` re-run in this session.
- 2.1: `config.test.ts` › "gives each video the layout override of its own format", "gives every video an empty layout
  override…", and the five refusals (`layout.16:9.caption.top`, `layout.9:16` unknown `frame`, `layout` unknown `4:5`,
  `layout.9:16.caption` width 120 px, `layout.1:1.endCard.phone.scale`) green.
- 2.2: `compose.test.ts` › "composes the fixture project's layout override, which changes only the caption font size"
  green; the HTML with `56px` put back to `50px` equals the default composition.
- 2.3: `tests/schema.test.ts` (drift and descriptions) green after `npm run schema -w @softure-ai/marketing-kit`.
- 2.5: `MARKETING_KIT_RENDER=1 … npx vitest run tests/render` passed (78.8 s); the built `index.html` has
  `.pill{font-weight:650;font-size:56px`.
- 2.6: verified by agent on a rendered frame (see plan.md).

## Triage summary
Fixed: -. Accepted: F1, F2, F3. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 Top bound at the frame edge → accept (the box height depends on the copy).
- F2 Hand-kept override type → accept (keeps the layer direction compose ← config).
- F3 CLI summary without override → accept (reads only the frame).
