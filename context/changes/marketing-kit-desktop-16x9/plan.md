# Plan: marketing-kit-desktop-16x9

Input: change.md, research.md. Complexity: medium (one package, three layers: geometry and composition, config
contract, recorder).

## Goal
A video in `marketing.json` asks for a desktop device:
`"device": { "kind": "desktop", "viewport": [1280, 800], "scale": 1.5 }` with `"format": "16:9"`. The recorder opens a
desktop browser for it (`isMobile: false`, no touch, mouse clicks), sizes its camera moves from a desktop layout, and the
composition frames the recording as a browser window (a bar with three dots and the end card's URL in an address
pill) in a 1920×1080 frame, with the same captions, persona card and end card. The schema refuses a desktop device on
a 9:16 or 1:1 film, a desktop device with `mobile: true`, and a desktop viewport that is portrait or narrower than
1024 px, each on the path of the key to fix. `layout.desktop` overrides the desktop layout as `layout["16:9"]` does
the phone's. Phone films compose and record exactly as before. The fixture project has a desktop film that renders to
a 1920×1080 MP4.

**Out of scope:** desktop 9:16 or 1:1 films; a mouse-cursor marker (the tap ring marks a click); scroll-wheel or hover
actions in the Director; a per-video layout; `src/og/` (FU-23); publishing.

## Approach
**Starting point:** the layout table has one phone entry per format (`timeline.ts:63`); the recorder always touches and
sizes moves from the 9:16 layout (`record.ts:86`, `:115`, `:279`); the composition's only non-geometry pixels are the
phone's bezel and markup (`compose.ts:320-321`, `:351`) (research §Summary).

**Chosen:** a fourth layout entry, `desktop`, in the same table, keyed by a *layout name*
(`LAYOUT_NAMES = [...VIDEO_FORMATS, "desktop"]`). Each layout carries its `format` and its `window`
(`"phone" | "browser"`); `phoneBox` becomes `screenBox` (it boxes a browser screen too). `getLayoutName(format,
deviceKind)` picks `desktop` for a desktop device, else the format. `getGeometry(viewport, name, override)` and
`resolveLayout(name, override)` take the name; `Geometry` gains `layout` and `window`. The composition draws the window
the geometry names. `Device` becomes a union (`kind: "phone"` with `isMobile`, `kind: "desktop"` without). The recorder
uses the desktop layout for a desktop film (the 9:16 one for a phone, as now) and clicks with the mouse.
Rejected: a `window` flag on the 16:9 entry decided at render time (the desktop box differs from the phone box, and
FU-16's `layout["16:9"]` override is tuned for the phone layout); a fourth `VideoFormat` `"16:9-desktop"` (the format is
the frame; the device is a separate choice, and posts, CLI output and the schema's format enum would all learn a
non-format); deciding desktop from `mobile: false` alone (a phone without mobile emulation is valid today:
`tests/config.test.ts:123`).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| How a video asks | `device.kind: "phone" \| "desktop"`, default `phone` | explicit, discriminated; old configs unchanged | research §Current state |
| Formats with desktop | 16:9 only; refused on `videos[i].format` | roadmap outcome; a desktop window in 9:16 is unreadable | roadmap |
| `mobile` | becomes optional; phone defaults to `true`, desktop refuses `true` | a desktop browser is never a mobile one | research §Summary |
| Desktop viewport | width ≥ 1024, height ≤ width (`isDesktopViewport`) | a landscape desktop page; fits the window box at any ratio | plan |
| Desktop layout | screen box centred at x 960, top 168, max 1600×840; camera target (960, 560); caption top 880, margins 260, 50 px; persona top 14, centred; end card copy right (top 330, left 1080, right 100, 80 px) with the window at scale 0.5 centred (560, 540) | the window fills the frame; copy over its foot as in 9:16; end card like the 16:9 phone | plan |
| Browser bar | 52 px, drawn in `compose.ts` like the phone's 14 px bezel; the address pill shows `endCard.url` | the public URL, never the recorded `localhost` | plan |
| Recorder geometry | desktop film: `getGeometry(viewport, "desktop")`; phone film: `getGeometry(viewport)` as now | phone logs stay frame for frame | research §Summary |
| Clicks | `page.mouse.click(x, y)`; context `hasTouch: false`, `isMobile: false` | a desktop browser has no touch screen | research §Summary |
| Layout override | `layout.desktop`, same keys and bounds rule as FU-16; `endCard.phone` described as the window's pose | one override contract | FU-16 |
| Fixture | `fixture-desktop`: 16:9, desktop 1280×800 at scale 1.5, the same scene module and sentences | answers Unknown 1; shares the generated voiceover | research §Answers |
| Version bump | none | unpublished `0.0.0` (MK-8 publishes) | plan |

**Critical details:** the four phone snapshots (`film-9x16`, `film-1x1`, `film-16x9`, `film-9x16-layout`) must not
change: the phone CSS and markup strings stay character for character. `fitsFrame` keeps reading the 9:16 screen box.
Every new schema key gets a `.describe()`; regenerate the JSON Schema.

## Phase 1: A desktop layout and a browser window in the composition
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/compose/timeline.ts`, `src/compose/timeline.test.ts`,
`src/compose/compose.ts`, `src/compose/compose.test.ts`, `tests/snapshots/film-16x9-desktop.html` (new),
`src/config/schema.ts` (type follow-up only), `src/render/render.ts`, `src/cli/main.ts`, `src/index.ts`

1. Tests first: `getGeometry({1280×800}, "desktop")` → frame 1920×1080, screen left 288, top 168, width 1344,
   `screenScale` 1.05, `screenHeight` 840, `window` "browser", `format` "16:9"; phone layouts report `window` "phone";
   `getLayoutName("16:9", "desktop")` = "desktop", `getLayoutName(f, "phone")` = f; `isDesktopViewport` true for
   1280×800 and 1024×1024, false for 1023×700 and 800×1280; `resolveLayout("desktop", {})` equals the table entry.
2. `timeline.ts`: `LAYOUT_NAMES`, `LayoutName`, `DEVICE_KINDS`, `DeviceKind`, `WindowKind`; `Layout.format`,
   `Layout.window`, `phoneBox` → `screenBox`; the `desktop` entry; `getLayoutName`, `isDesktopViewport`;
   `resolveLayout`/`getGeometry` keyed by name; `Geometry.layout`, `Geometry.window`; module comment updated.
3. `compose.ts`: the window part of the CSS and markup chosen by `geometry.window`; the browser window has the bar
   (dots, address pill with `endCard.url`, escaped) and the `.screen` below it.
4. `compose.test.ts`: the desktop composition (the test film as a desktop film at 1280×800) into
   `tests/snapshots/film-16x9-desktop.html`; it has `class="window"`, the escaped URL in the address pill, no
   `class="phone"`; the end-card pose follows the desktop entry (oracle by hand in the test).
5. Callers compile against the name (`render.ts`, `cli/main.ts`, `schema.ts` `layoutOverrideSchema`) without changing
   behaviour yet; `index.ts` exports the new names.

**Done when:**
- Automated: the new timeline and compose tests pass.
- Automated: the four phone snapshots are unchanged (no snapshot file but the new one in the diff).
- Automated: Gates green (typecheck, lint, test).

## Phase 2: The desktop device in marketing.json
**Discipline:** TDD. **Files:** `src/config/schema.ts`, `src/config/config.ts`, `src/film.ts`, `src/render/render.ts`,
`src/cli/main.ts`, `tests/config.test.ts`, `src/film.test.ts`, `src/compose/compose.test.ts`,
`schema/marketing.schema.json`, `README.md`

1. Tests first in `tests/config.test.ts`: a video with `device.kind: "desktop"` and `format: "16:9"` loads as
   `{ kind: "desktop", viewport, scale }` and gets `layout.desktop`, not `layout["16:9"]`; a phone device without `kind`
   loads as `{ kind: "phone", …, isMobile: true }`; refusals by path: desktop on a 9:16 video (`videos.0.format`),
   desktop on `app.device` with a default-format video (`videos.0.format`), `mobile: true` on a desktop
   (`…device.mobile`), a portrait desktop viewport (`…device.viewport`), `layout.desktop.caption` margins too wide.
2. `schema.ts`: `kind` on `deviceSchema` (default `phone`), `mobile` optional, per-kind viewport rule in a
   `superRefine`; `layout` keyed by `LAYOUT_NAMES`; the desktop-format rule in the top-level `superRefine`;
   descriptions for every new key; `format`'s description names the browser window.
3. `film.ts`: `Device` as a discriminated union. `config.ts`: builds it; `layout` from
   `getLayoutName(video.format, kind)`. `render.ts` and `cli/main.ts`: `getGeometry(viewport, getLayoutName(...), layout)`.
4. Hand-built films in tests get `kind: "phone"`.
5. Regenerate `schema/marketing.schema.json`; README: `device` row (kind, mobile), `layout` row (desktop key), the
   formats paragraph (desktop 16:9 is built; scales are relative to the screen, so a wide element on a desktop page
   needs a lower scale than on a phone, plan review S1).

**Done when:**
- Automated: the new config tests pass (load, kind default and the five refusals with their paths).
- Automated: `tests/schema.test.ts` passes on the regenerated file (drift and descriptions).
- Automated: Gates green (typecheck, lint, test) and `npm run build`.

## Phase 3: The recorder's desktop mode and the fixture's desktop film
**Discipline:** test-after (the recorder needs a browser; covered by the opt-in render). **Files:**
`src/record/record.ts`, `examples/fixture/marketing.json`, `tests/render.test.ts`, `tests/config.test.ts`

1. `record.ts`: desktop context (`isMobile: false`, `hasTouch: false`), `tap` clicks with the mouse on a desktop,
   `geometry` from the desktop layout for a desktop film; the module comment says so.
2. Fixture: a `fixture-desktop` video (16:9, desktop 1280×800 at scale 1.5, `sceneModule` `films/fixture-tour.ts`,
   the same sentences, voice, screen guard and end card as `fixture-tour`; its own hook scales 1.2 and 1.05, because
   the page's paragraphs span the 1280 px column and 1.6 would crop them, plan review W1).
3. `tests/render.test.ts`: after the phone film, `all fixture-desktop` renders a 1920×1080 MP4 with audio and the
   printed length matches; its log has the same beats and taps count as the phone film's.
4. A config test checks the fixture's desktop film loads as desktop 16:9.

**Done when:**
- Automated: the opt-in render test passes (`MARKETING_KIT_RENDER=1`) with both films.
- Automated: Gates green (typecheck, lint, test) and `npm run build`.
- Manual: frames of the rendered desktop film (the opening and a scene frame) show the app in a browser window, the
  opening's text whole and the caption over the window's foot.

## Risks and rollback
- Phone output drifts → the four snapshots and the twin-log comparison fail; fix before merge.
- CI render time grows by one film → the job has a 15-minute limit and the test 10; measured in phase 3.
- Rollback: revert the phase commits; configs without `kind: "desktop"` are unaffected either way.

## Decisions (auto)
- Complexity → medium (three layers, no data).
- Layout name `desktop` in `marketing.json` `layout` (not `16:9-desktop`): only 16:9 has a desktop layout, and the key
  reads as the device the films use.
- Neutral grey window dots, not traffic-light colours: the window must fit any brand's background.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: A desktop layout and a browser window in the composition

#### Automated
- [ ] 1.1 The new timeline and compose tests pass
- [ ] 1.2 The four phone snapshots are unchanged
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: The desktop device in marketing.json

#### Automated
- [ ] 2.1 The new config tests pass (load, kind default and the five refusals with their paths)
- [ ] 2.2 `tests/schema.test.ts` passes on the regenerated file
- [ ] 2.3 Gates green (typecheck, lint, test) and build

### Phase 3: The recorder's desktop mode and the fixture's desktop film

#### Automated
- [ ] 3.1 The opt-in render test passes with both films
- [ ] 3.2 Gates green (typecheck, lint, test) and build

#### Manual
- [ ] 3.3 Frames of the rendered desktop film show the app in a browser window, the opening's text whole and the caption over its foot
