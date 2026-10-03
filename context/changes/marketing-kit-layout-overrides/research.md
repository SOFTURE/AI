# Research: marketing-kit-layout-overrides

Input: change.md, roadmap FU-16. Depth: quick (one package, a pure geometry table and its config contract, no data).
Snapshot: 982ad7a (master, after FU-5), 2026-10-04 01:30 CEST.

## Summary
- The layout is one constant table, `LAYOUTS: Record<VideoFormat, Layout>` (`tools/marketing-kit/src/compose/timeline.ts:60-85`),
  read only by `getGeometry(viewport, format = "9:16")` (`timeline.ts:116-132`), which copies it into a `Geometry`.
- `composeFilm` reads every overridable entry from `Geometry` and nowhere else: caption box and font size
  (`compose.ts:326-327`), persona box (`compose.ts:329`), end-card box and headline size (`compose.ts:334`, `337`),
  end-card phone pose (`compose.ts:222-229`). So an override merged in `getGeometry` reaches the whole composition.
- `getGeometry` is called in three places: the recorder (`record/record.ts:86`, 9:16 default, for `fitScale`), the
  render (`render/render.ts:119`) and the CLI's summary line (`cli/main.ts:129`). The recorder only uses `frame.width`
  and `screenScale` (`timeline.ts:168-171`), which depend on `frame` and `phoneBox`.
- Answers to the roadmap Unknowns: expose `caption`, `persona` and `endCard` (with `phone`), not `frame`, `phoneBox`
  or `cameraTarget`; overrides are per format, in a top-level `layout` section keyed by format (reasons below).
- No composition depends on an override today, so the existing snapshots stay identical if the merge with an empty
  override returns the table's values.

## Current state
- Types: `TextBox { top, left, right }`, `CaptionLayout extends TextBox { fontSize }`,
  `EndCardLayout extends TextBox { headlineSize, phone: { scale, center: Point } }`, `Layout` adds `frame`, `phoneBox`,
  `cameraTarget` (`timeline.ts:29-56`). All are exported from `src/index.ts:88-100` with `LAYOUTS`.
- Config: `videos[].format` is `z.enum(VIDEO_FORMATS).default("9:16")` (`config/schema.ts:274`); `resolveVideos`
  copies it to `VideoConfig.format` (`config/config.ts:125`), which extends `FilmScript` (`film.ts:62-83`).
- The fixture project (`tools/marketing-kit/examples/fixture/marketing.json`) has two 9:16 films; it feeds the opt-in
  render test (`tests/render.test.ts`) and `getFixtureVideo()` (`examples/fixture/prepare.ts:27-33`), which loads it
  through `loadMarketingConfig` and works without ffmpeg.
- Snapshots: `tests/snapshots/film-9x16.html`, `film-1x1.html`, `film-16x9.html` from `src/compose/compose.test.ts:226-235`.
- `fitsFrame` (`timeline.ts:107-110`) checks a device against the 9:16 `phoneBox`; the schema uses it on `device`.

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Geometry | `tools/marketing-kit/src/compose/timeline.ts` | override type, merge into `getGeometry` |
| Config schema | `tools/marketing-kit/src/config/schema.ts` | `layout` section, per-format bounds, cross-field rule |
| Config resolution | `tools/marketing-kit/src/config/config.ts`, `src/film.ts` | the video carries its format's override |
| Consumers | `src/render/render.ts:119`, `src/cli/main.ts:129` | pass the override to `getGeometry` |
| Exports | `src/index.ts` | the override type |
| Generated file | `tools/marketing-kit/schema/marketing.schema.json` | regenerated, committed |
| Fixture | `examples/fixture/marketing.json` | an override (roadmap Baseline "after") |
| Tests | `src/compose/timeline.test.ts`, `src/compose/compose.test.ts`, `tests/config.test.ts`, a new snapshot | merge, composition, validation |
| Docs | `tools/marketing-kit/README.md:137`, `:363-365` | the `layout` key; the "not built" line |

## Data
none.

## Tests
- `src/compose/timeline.test.ts` covers `getGeometry` per format; `compose.test.ts` the snapshots and the per-format CSS
  (`compose.test.ts:236-259`); `tests/config.test.ts` loading and refusals with paths (`it.each` at 162, 200);
  `tests/schema.test.ts` the drift and the descriptions guard. Run: `npx vitest run tools/marketing-kit` or `npm test`.
- Render test is opt-in (`MARKETING_KIT_RENDER=1`, see `tests/render.test.ts:14-19`); it renders `fixture-tour`, so a
  9:16 override in the fixture goes through record, compose and render.

## Patterns to follow
- Per-entry schemas built from a list with `Object.fromEntries(LIST.map(...))` and a cast (`schema.ts`, `sfxShape`).
- Cross-field rules in `superRefine` with an explicit `path` (`schema.ts` `checkScene`, the top-level `superRefine`).
- Every key `.describe()`d; regenerate with `npm run schema -w @softure-ai/marketing-kit`.
- Pure geometry in `timeline.ts`; `composeFilm` has no pixel values of its own (MK-6 notes).

## Prior work
- `context/archive/2026-10-03-mk-formats/` (MK-6): built `LAYOUTS`, deferred this as framing 3 (`frame.md`).
- `context/archive/2026-10-03-marketing-kit-schema-docs/` (FU-14): the description guard every new key must pass.
- No in-flight change touches `timeline.ts` or `schema.ts`: FU-13 (#47) works in CI and the render test, FU-17 (#50)
  in `src/og/`, FU-9 (#49) in billing.

## SOFTURE modules
not applicable: the marketing-kit's own config contract.

## Risks
- An override that moves a box out of the frame or leaves no width for the text renders a broken film after a paid
  recording. Likelihood medium. Mitigation: per-format bounds in the schema (0…frame size) and a cross-field rule on
  the merged box width, with the path of the key to fix.
- The 9:16 snapshot drifts because the merge reorders keys or changes numbers. Likelihood low. Mitigation: the merge
  starts from the table's values; the snapshot tests run unchanged.
- Changing the fixture's film changes FU-13's CI render. Likelihood low (the render test checks size, duration and
  posts, not pixels). Mitigation: a small caption change; FU-13 merges master before its own merge.

## Relevant lessons
none: L-001 (build) and L-002 (Next imports) do not apply.

## Answers to unknowns
- **Which entries are worth exposing?** `caption` (`top`, `left`, `right`, `fontSize`), `persona` (`top`, `left`,
  `right`), `endCard` (`top`, `left`, `right`, `headlineSize`, `phone.scale`, `phone.center.x`, `phone.center.y`):
  exactly the entries the roadmap outcome names, and the ones only `composeFilm` reads. Not `frame` (it *is* the
  format: 1080×1920 etc.), not `phoneBox` (it sets `screenScale`, which the recorder uses for `fitScale` at 9:16 and
  `fitsFrame` uses for the device check: an override would make the recording depend on config the recorder does not
  see), not `cameraTarget` (camera framing of the recorded marks; no ask, and it interacts with the phone box).
- **Per video or per format?** Per format, top level: `"layout": { "16:9": { "caption": { "fontSize": 44 } } }`. A
  brand's caption style or long headlines are a property of the brand in a format, and every film of that format
  should look alike. A per-video override can be layered later without breaking this contract; nobody needs it now.

## Open questions
none.

## Decisions (auto)
- Depth quick: one package, a pure table.
- Framing skipped (see change.md Notes).
- Exposed keys and scope → as in Answers (roadmap outcome, recorder independence).
