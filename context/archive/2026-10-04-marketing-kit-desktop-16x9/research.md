# Research: marketing-kit-desktop-16x9

Input: change.md, roadmap FU-15. Depth: quick (one package; the recorder, the geometry table and the config contract;
no data). Snapshot: 2e5cc3c (master, after FU-19), 2026-10-04.

## Summary
- The recorder already passes `film.device.isMobile` to Playwright (`src/record/record.ts:114`) but always sets
  `hasTouch: true` (`:115`) and taps with `page.touchscreen.tap` (`:279`); a desktop browser has no touch screen, so a
  desktop mode needs mouse clicks and `hasTouch: false`.
- The recorder sizes camera moves with `getGeometry(viewport)` (9:16 default, `record.ts:86`); its only geometric
  use is `fitScale(geometry, rect)` (`record.ts:307`), which reads `frame.width` and `screenScale`
  (`src/compose/timeline.ts:217`). A desktop recording renders in one layout only, so it can size its moves from that
  layout; phone recordings keep the 9:16 default and their logs stay frame for frame.
- The composition reads every position from `Geometry` except the phone's bezel (`src/compose/compose.ts:320-321`,
  14 px and the radii) and the `<div class="phone">` markup (`compose.ts:351`). A browser window is a second shape of
  that one wrapper around the same `.screen`; everything inside `.screen` (recording, rewind, stills, tap markers in
  screen px) is unchanged.
- `LAYOUTS: Record<VideoFormat, Layout>` (`timeline.ts:63`) has one entry per format. A desktop film is 16:9 with a
  different box (a wide window, not a tall phone), so it needs its own layout entry; FU-16's per-format override
  (`layout["16:9"]`) is tuned for the phone layout (copy right of the phone at x 1100) and must not apply to it.
- The device check `fitsFrame` (`timeline.ts:146`, used by the schema at `src/config/schema.ts:174`) refuses a viewport
  too tall for the 9:16 phone box; a desktop viewport needs its own check (landscape, fits the window box).

## Answers to the roadmap Unknowns
- **Can a phone film's scene be reused at a desktop viewport?** Yes, when the app is responsive. A scene talks to the
  page through locators and the Director (`src/film.ts` `Director`); nothing in it is in phone pixels except the
  explicit `scale` values, which are relative to the screen (below). The fixture scene (`examples/fixture/films/fixture-tour.ts`)
  only uses `fill`, `tap`, `focus`, `mark`, `bring` on locators. So a desktop video can point `sceneModule` at the
  same file or carry the same `actions`; a project writes its own scene only when the desktop page differs.
- **How do camera focus scales map to a wider screen?** They are relative to the screen in the frame
  (`cameraPose`, `timeline.ts`): scale 1 shows the whole screen as laid out. `fitScale` computes "fill 80% of the frame
  width" from the layout's `frame.width` and `screenScale`, so with the desktop layout it adapts on its own; explicit
  scales (`focus({ scale })`, hook shots, `fill`'s 1.55) zoom the same factor on the window, which on a ~1350 px wide
  window means a larger picture than on a 415 px phone. The 1.7 cap keeps the zoom within what a scale-1.5 to 2
  recording can show sharply.

## Current state
- Config: `deviceSchema` (`schema.ts:168`) is `{ viewport: [w, h], scale, mobile = true }`; `app.device` is required
  (`:196`), `videos[].device` optional (`:276`). `resolveVideos` builds `Device { viewport, scale, isMobile }`
  (`src/config/config.ts:127`) and `layout: data.layout?.[video.format] ?? {}` (`config.ts:126`).
- `getGeometry` callers: recorder (`record.ts:86`), render (`src/render/render.ts:119`), CLI summary line
  (`src/cli/main.ts:129`).
- Snapshots: `tests/snapshots/film-9x16.html`, `film-1x1.html`, `film-16x9.html`, `film-9x16-layout.html` from
  `src/compose/compose.test.ts`.
- Opt-in render (`tests/render.test.ts`, CI job `render` since FU-13) runs `all fixture-tour` and records
  `fixture-tour-actions`; the fixture voiceover is generated once for `videos[0]`'s key (`examples/fixture/prepare.ts`),
  which a video with the same sentences and voice shares.
- The fixture app (`examples/fixture/app/`) is a single column with `main { padding: 32px 20px }`; it renders at any
  width.

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Geometry | `src/compose/timeline.ts` | a desktop layout entry, the window kind, a layout name per film, a desktop viewport check |
| Composition | `src/compose/compose.ts` | a browser window around the screen |
| Recorder | `src/record/record.ts` | desktop context (no touch, no mobile), mouse clicks, the film's own layout for `fitScale` |
| Film type | `src/film.ts` | `Device` as a union of phone and desktop |
| Config | `src/config/schema.ts`, `src/config/config.ts`, `schema/marketing.schema.json` | device kind, desktop rules, `layout.desktop` |
| Consumers | `src/render/render.ts`, `src/cli/main.ts` | the film's layout name |
| Exports | `src/index.ts` | new helpers and types |
| Fixture | `examples/fixture/marketing.json` | a desktop film |
| Tests | `timeline.test.ts`, `compose.test.ts`, `tests/config.test.ts`, `tests/render.test.ts`, a new snapshot | |
| Docs | `tools/marketing-kit/README.md` (config table, formats paragraph at ~381) | |

## Data
none.

## Tests
- `src/compose/timeline.test.ts` (geometry per format), `src/compose/compose.test.ts` (snapshots, CSS per format),
  `tests/config.test.ts` (loading and refusals by path), `tests/schema.test.ts` (drift, descriptions). Run:
  `npx vitest run tools/marketing-kit` from the repo root.
- The render test is opt-in: `MARKETING_KIT_RENDER=1`, `PLAYWRIGHT_CHROMIUM_PATH`, `HYPERFRAMES_BROWSER_PATH`.

## Patterns to follow
- Pure geometry in `timeline.ts`; one merge (`resolveLayout`) used by geometry and schema (FU-16).
- Cross-field rules in `superRefine` with an explicit `path`; every key `.describe()`d; regenerate with
  `npm run schema -w @softure-ai/marketing-kit`.
- Discriminated unions instead of optional bags (AGENTS.md TypeScript conventions).

## Risks
- A phone snapshot or a phone log changing by accident: guarded by the existing byte-for-byte snapshots and the
  render test's twin-log comparison.
- Render time in CI grows by one more film (~1 minute); the job allows 15.
