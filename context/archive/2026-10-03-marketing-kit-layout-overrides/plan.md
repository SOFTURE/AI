# Plan: marketing-kit-layout-overrides

Input: change.md, research.md. Complexity: small.

## Goal
A project writes, in `marketing.json`, a top-level `layout` section keyed by format
(`"layout": { "16:9": { "caption": { "fontSize": 44 } } }`) that overrides entries of that format's layout: `caption`
(`top`, `left`, `right`, `fontSize`), `persona` (`top`, `left`, `right`) and `endCard` (`top`, `left`, `right`,
`headlineSize`, `phone.scale`, `phone.center.x`, `phone.center.y`). The schema refuses values outside the frame and a
box that leaves too little width for its text, on the path of the key to fix. `getGeometry` merges the override onto
the table, so every film of that format composes with it. Without overrides the three composition snapshots stay byte
for byte. The fixture project carries a 9:16 override, and a composition built from it differs from the default.

**Out of scope:** overriding `frame`, `phoneBox` or `cameraTarget` (research: they feed the recorder and the device
check); per-video overrides; the desktop 16:9 film (FU-15); other schema keys (FU-18, FU-19); publishing.

## Approach
**Starting point:** `LAYOUTS` is a constant table read only by `getGeometry` (`src/compose/timeline.ts:60-132`), and
`composeFilm` takes every overridable value from `Geometry` (research §Summary).

**Chosen:** a `LayoutOverride` type and a pure `resolveLayout(format, override)` in `timeline.ts` that merges key by key
(`override.x ?? table.x`); `getGeometry(viewport, format, override = {})` builds from it. The schema builds one strict
object per format from `LAYOUTS` (bounds and descriptions that name each format's default come from the table), with a
`superRefine` on the merged layout for the box widths. `resolveVideos` puts the video's format override on
`FilmScript.layout`; the render passes it to `getGeometry`.
Rejected: a generic deep merge (`{ ...table, ...override }`) - an explicit `undefined` from zod's optional output would
erase a table value, and a recursive helper hides which keys exist; overrides on the `Film` only at render time
(reading the config in `render.ts`) - the film would not carry what it is composed with; a per-video `layout` - nobody
needs it, and it can be layered on top later without breaking this contract.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope of an override | per format, top-level `layout` | a brand's caption style is per format; films of a format look alike | research §Answers |
| Exposed keys | caption, persona, endCard (+ phone pose) | the roadmap outcome; the recorder never reads them | research §Answers |
| Bounds | integers 0…frame width/height for positions; `fontSize` 16-200; `headlineSize` 16-300; `phone.scale` 0.2-1.5 | a value outside the frame is a broken film found after a paid recording | research §Risks |
| Cross-field rule | merged `left + right` leaves at least 200 px (`MIN_TEXT_WIDTH`) for caption, persona and end card; path `layout.<format>.<box>` | catches a margin override that only fails with the table's other margin | plan |
| Where the merge lives | `resolveLayout` in `timeline.ts`, used by `getGeometry` and the schema rule | one merge, pure, testable | plan |
| Film field | `FilmScript.layout: LayoutOverride` (`{}` when none) | the film carries what it is composed with | plan |
| Recorder | keeps `getGeometry(viewport)` without overrides | overrides never touch `frame` or `phoneBox`, the only inputs of `fitScale` | research §Summary |
| Fixture | `"layout": { "9:16": { "caption": { "fontSize": 56 } } }` | the roadmap "after"; also drives the opt-in render | roadmap Baseline |
| Version bump | none | the package is unpublished `0.0.0` (MK-8 publishes) | plan |

**Critical details:** keep `getGeometry`'s default arguments so the three existing callers and the snapshot tests
compile and produce the same `Geometry`; `resolveLayout` returns fresh objects (no aliasing of `LAYOUTS`, as today).
Each new schema key needs a `.describe()` (guard in `tests/schema.test.ts`); regenerate the JSON.

## Phase 1: Layout overrides in the geometry
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/compose/timeline.ts`, `tools/marketing-kit/src/compose/timeline.test.ts`,
`tools/marketing-kit/src/index.ts`

1. Tests first in `timeline.test.ts`: `resolveLayout(format, {})` equals `LAYOUTS[format]` for every format and is not
   the same object; an override of `caption.fontSize` changes only that value; an override of `endCard.phone.center.x`
   keeps `center.y` and `scale`; an override key set to `undefined` keeps the table value; `getGeometry(viewport,
   "16:9", override)` carries the overridden caption, persona and end card; `LAYOUTS` is unchanged after the calls.
2. `timeline.ts`: `LayoutOverride` type, `resolveLayout(format, override = {})`, `getGeometry(viewport, format = "9:16",
   override = {})` built on it; the module comment says which entries a project can override and why the others not.
3. `index.ts`: export `resolveLayout` and `type LayoutOverride`.

**Done when:**
- Automated: the new `timeline.test.ts` cases pass.
- Automated: the three composition snapshots are unchanged (`compose.test.ts` green, no snapshot file changed).
- Automated: Gates green (typecheck, lint, test).

## Phase 2: The layout section in marketing.json
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/config/schema.ts`, `tools/marketing-kit/src/config/config.ts`,
`tools/marketing-kit/src/film.ts`, `tools/marketing-kit/src/render/render.ts`, `tools/marketing-kit/tests/config.test.ts`,
`tools/marketing-kit/tests/layout.test.ts` (new), `tools/marketing-kit/tests/snapshots/film-9x16-layout.html` (new),
`tools/marketing-kit/schema/marketing.schema.json`, `tools/marketing-kit/examples/fixture/marketing.json`,
`tools/marketing-kit/README.md`

1. Tests first in `tests/config.test.ts`: a `layout` with a 16:9 override loads, a 16:9 video gets it on `layout` and a
   9:16 video gets `{}`; refusals by path: `layout.16:9.caption.top` past the frame height, `layout.9:16.frame` (unknown
   key), `layout.4:5` (unknown format), `layout.9:16.caption` when `left` leaves less than 200 px with the table's
   `right`, `layout.1:1.endCard.phone.scale` out of range.
2. `schema.ts`: `layoutSchema` from `VIDEO_FORMATS` and `LAYOUTS` (per-format bounds; descriptions name the format's
   default), the width rule in a per-format `superRefine` using `resolveLayout`; top-level `layout` optional, described.
3. `film.ts`: `FilmScript.layout: LayoutOverride`. `config.ts` `resolveVideos`: `layout: data.layout?.[video.format] ?? {}`.
   `render.ts:119`: `getGeometry(film.device.viewport, film.format, film.layout)`.
4. Regenerate `schema/marketing.schema.json` with `npm run schema -w @softure-ai/marketing-kit`.
5. Fixture: add `"layout": { "9:16": { "caption": { "fontSize": 56 } } }` to `examples/fixture/marketing.json`.
6. `tests/layout.test.ts`: the fixture film's override (`getFixtureVideo().layout`) composes the 9:16 test film into
   `tests/snapshots/film-9x16-layout.html`; the HTML has `font-size:56px` on the caption pill, and with that rule
   put back to the default `font-size:50px` it equals the default composition exactly (plan review W1).
7. `README.md`: a `layout` row in the configuration table (around line 137) and the formats paragraph (around line
   363-365) no longer says layout overrides are not built.

**Done when:**
- Automated: the new config tests pass (load and the five refusals with their paths).
- Automated: `tests/layout.test.ts` passes; the composition from the fixture override differs from the default only in the caption font size.
- Automated: `tests/schema.test.ts` passes on the regenerated file (drift and descriptions).
- Automated: Gates green (typecheck, lint, test) and `npm run build`.
- Automated: the opt-in render test passes on the fixture with its override (`MARKETING_KIT_RENDER=1`).
- Manual: owner looks at a rendered fixture frame and finds the larger caption readable.

## Risks and rollback
- A bound too tight refuses a sensible layout → fix forward by widening the bound; the error names the key.
- The fixture override changes FU-13's CI render → it checks size, duration and posts only; caption size is neither.
- Rollback: revert the two phase commits; projects without `layout` see no difference either way.

## Decisions (auto)
- Complexity → small (one package, pure table, no data).
- Scope and keys → per format, caption/persona/endCard (research Answers).
- Implementation drift (small): the fixture-override composition test lives in `src/compose/compose.test.ts` next to
  the other snapshot tests (it reuses that file's film, log and assets) instead of a new `tests/layout.test.ts`;
  `film.test.ts` and `compose.test.ts` add `layout: {}` to their hand-built films (the field is required);
  `backlog-input.md` lost one `../` on its roadmap link (moved file, links test).
- `MIN_TEXT_WIDTH` → 200 px (narrowest default box is 700 px at 16:9; 200 px still fits a short caption at 50 px).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Layout overrides in the geometry

#### Automated
- [x] 1.1 The new `timeline.test.ts` cases for `resolveLayout` and `getGeometry` with an override pass — 0f71705
- [x] 1.2 The three composition snapshots are unchanged — 0f71705
- [x] 1.3 Gates green (typecheck, lint, test) — 0f71705

### Phase 2: The layout section in marketing.json

#### Automated
- [x] 2.1 The new config tests pass (load and the five refusals with their paths) — cb8aadb
- [x] 2.2 `tests/layout.test.ts` passes; the fixture override changes only the caption font size — cb8aadb
- [x] 2.3 `tests/schema.test.ts` passes on the regenerated file — cb8aadb
- [x] 2.4 Gates green (typecheck, lint, test) and build — cb8aadb
- [x] 2.5 The opt-in render test passes on the fixture with its override — cb8aadb

#### Manual
- [x] 2.6 Owner looks at a rendered fixture frame and finds the larger caption readable — cb8aadb (verified by agent: a frame at 1.5 s of the rendered fixture film shows the 56 px caption pill whole and readable over the phone)
