# Research: mk-formats

Input: change.md, roadmap MK-6, research.sources (`docs/03-marketing-kit.md`; FIRE_TRACKER is not checked
out in this session and FIRE renders 9:16 only, so it has nothing to say about other formats). Depth: quick
(no data, no money; compose-only, a 9:16 baseline guards the risk). Snapshot: e15e5c5 (master after
PR #35), 2026-10-03.

## Summary

Every 9:16 number the composition uses lives in two places: the `Geometry` from
`getGeometry(viewport)` (`tools/marketing-kit/src/compose/timeline.ts:33-55`: frame, phone screen,
camera target) and inline px in `composeFilm` (`src/compose/compose.ts`: caption box, persona card,
end card, the end-card camera pose). Moving the second group into `Geometry` and keying the table by
format is enough for 1:1 and 16:9; the recording does not need to change, because every camera scale
in the recording log is relative to the phone layer, not to the frame.

## Current state

- `VIDEO_FORMATS = ["9:16"]` (`timeline.ts:12`); the schema reads it (`src/config/schema.ts:181`,
  `format: z.enum(VIDEO_FORMATS).default("9:16")`), so adding formats there is the only schema change.
- `getGeometry(viewport)` (`timeline.ts:44`): frame 1080×1920, screen `{ left: 220, top: 214, width: 640 }`,
  `screenScale = 640 / viewport.width`, camera target `(540, 900)`.
- `fitsFrame(viewport)` (`timeline.ts:39`) rejects a device too tall for 9:16; the schema refines every
  `device` with it (`schema.ts:140`).
- `composeFilm` (`compose.ts:213-398`) inline layout: end-card camera pose `scale 0.58`, centre
  `(frame.width / 2, 640)` (`compose.ts:252-261`); `.caption{left:60px;right:60px;top:1470px}` with a
  50 px pill; `.persona{top:78px}`; `.endcard{top:1180px}` with a 96 px headline; phone radius 66/52 px.
- `captionChunks(words, maxWords = 4)` (`timeline.ts:121`) cuts captions; compose uses the default.
- Callers of `getGeometry`: `src/render/render.ts:119` (composition), `src/cli/main.ts:125` (prints the
  frame size), `src/record/record.ts:86` (only for `fitScale` of focus cues; MK-3 owns that file).

## Affected surface

- `src/compose/timeline.ts`: formats, geometry table, `getGeometry(viewport, format)`.
- `src/compose/compose.ts`: read layout from `Geometry`.
- `src/render/render.ts:119`, `src/cli/main.ts:125`: pass `film.format`.
- `src/config/schema.ts` enum (via `VIDEO_FORMATS`) → `schema/marketing.schema.json` regenerated.
- Tests: `src/compose/*.test.ts`, `tests/config.test.ts:179` (uses `1:1` as "a format not built yet").
- Docs: `tools/marketing-kit/README.md:107,191`.

## Data

No database. Contract change: `videos[].format` accepts `1:1` and `16:9`.

## Tests

`compose.test.ts` asserts fragments of the HTML, not the whole of it; there is no composition snapshot
yet. The baseline the roadmap asks for is therefore taken here: the 9:16 HTML of the test input on
master, stored as a file snapshot before any refactor. `tests/render.test.ts` (opt-in) renders the fixture
film in 9:16 and checks 1080×1920.

## Patterns to follow

- Pure geometry functions in `timeline.ts`, tested with oracles on paper (`timeline.test.ts`).
- `escapeHtml` for every text, numbers rounded with `r3` before they land in HTML.
- No FIRE literal in `src/` (`tests/architecture.test.ts`).

## Prior work

MK-2 (`archive/2026-10-03-mk-config-contract/`) made `Geometry` an input of every camera function and
left "formats other than 9:16, and a geometry table" to this item.

## SOFTURE modules

None apply (no auth, mail, billing or UI primitives involved).

## Risks

- `fitScale` is computed while recording with the 9:16 geometry. If the composition used a different
  scale basis per format, one recording would need per-format scales. Kept relative to the phone, the
  same log serves every format (the zoom is "×N of the phone"), which is what a reader expects.
- The device check (`fitsFrame`) is a 9:16 rule. In 1:1 and 16:9 the phone shrinks to fit the height,
  so any device the schema accepts fits; the check stays as is.

## Relevant lessons

L-001 (build through tsc) and L-002 (Next imports) do not apply. None other.

## Answers to unknowns

- **16:9: desktop recording or a framed phone?** A framed phone. A desktop recording changes what is
  recorded (viewport, `isMobile`, scenes written for a desktop layout), which is `src/record/` (MK-3) and
  each project's scenes; the composition alone cannot produce it. A phone on the left with captions,
  persona and end card on the right uses the 16:9 space and keeps one recording per film. See `frame.md`.
- **How do captions wrap in 1:1?** The same 4-word chunks in a 960 px wide box (60 px margins) at 44 px:
  one line for typical chunks, two lines for long words; the pill grows down from y = 830 and stays
  inside the 1080 px frame (two lines ≈ 136 px).

## Open questions

None.
