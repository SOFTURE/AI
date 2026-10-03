# Plan: mk-formats

Input: change.md, research.md, frame.md. Complexity: small (two phases, compose-only).

## Goal

- `videos[].format` in `marketing.json` accepts `9:16`, `1:1` and `16:9`; the rendered MP4 is
  1080×1920, 1080×1080 or 1920×1080.
- One geometry table in `src/compose/timeline.ts`, keyed by format, holds the frame, the phone box, the
  camera target, the caption box, the persona card and the end card (position, headline size, phone pose).
  `composeFilm` has no layout px of its own left.
- The 9:16 composition of the test film is byte-identical to master (file snapshot taken before the refactor);
  1:1 and 16:9 have their own snapshots.
- The same recording renders in every format (no change in `src/record/`).

**Out of scope:** a desktop recording for 16:9 and geometry overrides in `marketing.json` (frame.md
framings 2 and 3, go to followups); per-format device checks in the schema (the phone shrinks to fit in 1:1
and 16:9, the 9:16 check stays); anything in `src/record/`, `src/voice/`, `src/screenshot/`, OG images.

## Approach

**Starting point:** `getGeometry(viewport)` returns 9:16 constants (`timeline.ts:33-55`); `composeFilm`
adds caption, persona and end-card px inline (`compose.ts:252-261`, CSS block); `widePose` centres on
`frame.width / 2` (`timeline.ts:85-93`).

**Chosen:** a `LAYOUTS: Record<VideoFormat, Layout>` table; `getGeometry(viewport, format = "9:16")`
fits the screen into the format's phone box (width `min(maxWidth, floor(maxHeight × w / h))`, centred
on the box) and copies the caption, persona and end-card entries into `Geometry`. `composeFilm` reads
them. `widePose` centres on the screen's centre, which equals `frame.width / 2` in 9:16. The default
format keeps `record.ts` (MK-3) untouched: its `fitScale` stays phone-relative, so the log serves every format.

Rejected: per-format compose templates - three copies of one HTML; a desktop recording - frame.md.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| 16:9 shape | framed phone left (centre x 600), copy column right (x 1100…1800) | one recording, no record changes | frame |
| 1:1 phone | fits a 900 px tall box from y 150, centred; captions 44 px from y 830 | room for persona above, captions over the phone's foot as in 9:16 | research |
| Camera scales | stay relative to the phone | the recording log is format-free | research |
| Baseline | file snapshot of the 9:16 HTML before the refactor | no snapshot existed; the roadmap baseline needs one | research |

**Table (px):**
| | 9:16 | 1:1 | 16:9 |
| --- | --- | --- | --- |
| frame | 1080×1920 | 1080×1080 | 1920×1080 |
| phone box (centreX, top, maxW, maxH) | 540, 214, 640, 1706 | 540, 150, 640, 900 | 600, 90, 640, 900 |
| camera target | 540, 900 | 540, 480 | 600, 500 |
| caption (top, left, right, font) | 1470, 60, 60, 50 | 830, 60, 60, 44 | 700, 1100, 120, 50 |
| persona (top, left, right) | 78, 0, 0 | 30, 0, 0 | 150, 1100, 120 |
| end card (top, left, right, headline) | 1180, 0, 0, 96 | 470, 0, 0, 72 | 330, 1100, 120, 80 |
| end-card phone (scale, centre) | 0.58, 540, 640 | 0.42, 540, 250 | 0.85, 600, 540 |

## Phase 1: Baseline and geometry table
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/compose/compose.test.ts`,
`tests/snapshots/film-9x16.html`, `src/compose/timeline.ts`, `src/compose/timeline.test.ts`

1. `compose.test.ts`: a file snapshot of `composeFilm(input)` (9:16), written on unchanged code and committed first.
2. `timeline.ts`: `VIDEO_FORMATS = ["9:16", "1:1", "16:9"]`; `Layout` and `LAYOUTS`; `Geometry` gains
   `format`, `caption`, `persona`, `endCard`; `getGeometry(viewport: Viewport, format: VideoFormat = "9:16")`;
   `fitsFrame` reads the 9:16 entry; `widePose` targets the screen's centre.
3. Moved here from Phase 2 during implementation (the enum change turns the schema drift test and
   `config.test.ts` red at once): regenerate `schema/marketing.schema.json`; `config.test.ts` accepts
   `1:1`/`16:9` and refuses `4:5`.

**Tests:** 1:1 and 16:9 geometry for 390×844 (screen width 415, left 333 / 393, height 898) from paper;
9:16 unchanged for 412×915; every format keeps the phone (with its 14 px bezel) inside the frame for
390×844 and for the tallest device `fitsFrame` accepts; `widePose` in 16:9 centres the phone on x 600.

**Done when:**
- Automated: timeline tests pass; Gates green (typecheck, lint, test).

## Phase 2: The composition, render and contract read the format
**Discipline:** TDD. **Files:** `src/compose/compose.ts`, `src/compose/compose.test.ts`,
`tests/snapshots/film-1x1.html`, `tests/snapshots/film-16x9.html`, `src/render/render.ts`,
`src/cli/main.ts`, `schema/marketing.schema.json`, `tests/config.test.ts`, `tools/marketing-kit/README.md`

1. `compose.ts`: caption, persona and end-card CSS and the end-card camera pose from `geometry`.
2. `render.ts`, `main.ts`: `getGeometry(film.device.viewport, film.format)`.
3. `npm run schema -w @softure-ai/marketing-kit`; `config.test.ts` accepts `1:1`/`16:9` and still refuses an unknown format (`4:5`).
4. README: the format row and the limitations line.

**Tests:** the 9:16 snapshot is unchanged; 1:1 and 16:9 snapshots; `data-width`/`data-height` per format;
a config with `format: "16:9"` loads; `format: "4:5"` is refused with `videos[0].format`.

**Done when:**
- Automated: compose and config tests pass; the 9:16 snapshot is untouched; Gates green (typecheck, lint, test, build).
- Manual: the opt-in render of the fixture film in 9:16, 1:1 and 16:9 gives MP4s of the right size, with the
  phone, captions, persona and end card inside the frame (frames checked by eye).

## Risks and rollback

- A 9:16 drift slips in → the byte snapshot from master fails. Rollback: revert the phase commit.
- 16:9 copy column overlaps a zoomed phone → zoom is capped at 1.7× a 415 px screen (≤ 600 px wide around
  x 600, so x ≤ 900 < 1100); checked in the manual render.
- Schema JSON drift with a parallel item editing `schema.ts` → regenerate after merging master.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Baseline and geometry table

#### Automated
- [x] 1.1 9:16 snapshot committed from unchanged code — 6dd2705
- [x] 1.2 Timeline tests pass; Gates green (typecheck, lint, test) — 8f62900

### Phase 2: The composition, render and contract read the format

#### Automated
- [x] 2.1 Compose and config tests pass, 9:16 snapshot untouched — b8ee00c
- [x] 2.2 Gates green (typecheck, lint, test, build) — b8ee00c

#### Manual
- [x] 2.3 Fixture film rendered in 9:16, 1:1 and 16:9; frames checked by eye — b8ee00c (verified by agent: draft renders 1080×1920, 1080×1080, 1920×1080 by ffprobe; frames at 2, 6 and 10 s show phone, captions, persona and end card inside the frame, 16:9 copy right of the phone)
