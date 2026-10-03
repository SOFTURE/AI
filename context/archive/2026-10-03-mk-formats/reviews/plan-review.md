# Plan review: mk-formats

Reviewed: plan.md @ 2026-10-03. Mode: quick (compose-only, low risk; the riskiest claims checked by hand).
Verdict: ready after fixes (applied).
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 7/7 paths (`src/compose/{timeline,compose}.ts`, `src/render/render.ts`, `src/cli/main.ts`,
`src/record/record.ts`, `src/config/schema.ts`, `tests/config.test.ts`), 6/6 symbols (`getGeometry`,
`fitsFrame`, `widePose`, `fitScale`, `composeFilm`, `VIDEO_FORMATS`), 4/4 commands (`npm run typecheck|lint|test|build`).

## Riskiest claims

1. "9:16 stays byte-identical." `widePose` moves from `frame.width / 2` to the screen's centre: in 9:16 that is
   220 + 640 / 2 = 540 = 1080 / 2. The end-card pose moves from `frame.width / 2`, `640` to the table's
   `540, 640`. The screen width formula gives 640 for every device `fitsFrame` accepts (its bound is exactly
   `maxHeight = 1920 − 214`). Holds; the byte snapshot checks it.
2. "The recording is format-free." `record.ts:300` uses `fitScale(getGeometry(viewport), rect)`; with the
   default format this is the 9:16 value as today, and compose applies it as a phone-relative scale. Holds.
3. "The phone fits 1:1 for any accepted device." The tallest accepted ratio is 1706 / 640 ≈ 2.67: width
   `floor(900 / 2.67) = 337`, height ≤ 900, bottom with bezel 150 + 900 + 14 = 1064 < 1080. Holds.

## Lenses

- Scope: compose and render geometry only; schema change limited to the enum via `VIDEO_FORMATS`. OK.
- Parallel items: no file of MK-3/4/5/7. `schema.json` regenerates after merging master. OK.
- Tests: oracles on paper for the new formats; byte snapshot for 9:16. OK.

## Findings

### W1 (warning): snapshots under `src/` would ship in the npm package
`package.json` `files` publishes `src` minus `*.test.ts`; `src/compose/__snapshots__/*.html` would be packed.
**Fix (applied):** snapshots live in `tools/marketing-kit/tests/snapshots/`.
**Decision:** fixed in plan.

### S1 (suggestion): the architecture test forbids `390`/`844` in non-test sources
The table must not carry device numbers; it does not (phone box only). Tests keep 390×844 as fixtures.
**Decision:** noted, no change.

## Triage summary

W1 fixed in the plan; S1 noted. Next: `softure-implement mk-formats`.
