---
change_id: marketing-kit-draft-look-1050
status: done
---

# Plan: the draft looks and sounds like the render (issue #1050)

Input: change.md, research.md (option 1). Complexity: medium.

## Phase 1: brand font and caption styles (TDD)

Files: `src/footage/draft-font.ts` (new), `src/footage/draft.ts`, `src/footage/draft.test.ts`.

- `readFontFamilyName(data)`: name ID 1 of an SFNT file (platform 3 UTF-16BE preferred, platform 1 Roman), bounds
  checked, an error value for WOFF/WOFF2 or a broken file.
- `chooseFootageDraftFont(brand.fonts.body)`: the first readable SFNT file of the body font, the normal style and
  the weight closest to 650 first; null → `FOOTAGE_DRAFT_FONT`.
- `toAssColor(hex)`: `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` → `&HAABBGGRR`.
- `buildFootageDraftCaptions` takes `film.captionStyle` and `colors?`: `phrase` unchanged (byte for byte);
  `highlight`: `captionChunks`, style `BorderStyle 3`, box padding 16, outline and back colour from
  `captionBackground`, text `captionText`, one event per interval with the lit words in `captionHighlight`.
  Without colours, the kit's default caption colours.
- `renderFootageDraft` takes `brand?`, copies the chosen font to `fonts/`, logs the font.

## Phase 2: music from the cache (TDD)

Files: `src/footage/pipeline.ts`, `src/footage/draft.ts`, tests.

- `findFootageMusic(film, edl, clips, { cacheDir, providers })` in `pipeline.ts`: `none`, `file`, `cached` or
  `missing`; `getMusic` uses it (behaviour unchanged).
- `buildFootageDraftArgs` takes `music: string | null`: speech and music summed with
  `amix=inputs=2:duration=first:normalize=0`.
- `renderFootageDraft` takes `cacheDir?`, `providers?`; builds the ducked track with `buildMusicArgs` over the cut's
  length; result `music: "none" | "played" | "not_cached"`; no provider is ever called (tests with the kit's fakes
  and call counters).

## Phase 3: docs

README "Footage draft" (what it matches, what it leaves out), CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: brand font and caption styles (b142ae9, one commit with phase 2)
- [x] Phase 2: music from the cache (b142ae9)
- [x] Phase 3: docs (5c8bb45)

## Verification

- `vitest run tools/marketing-kit`: 68 files, 1002 tests green (4 skipped as before), the draft's real-ffmpeg tests
  included: a `highlight` film with a brand font whose CSS family differs from the file's and cached prompt music
  drafts with music, zero music provider calls; uncached music and a draft without `cacheDir` draft without music and
  log why; a gone music file is an error.
- A 1080x1920 highlight draft frame checked by eye: the box in `captionBackground`, the lit word in
  `captionHighlight`, Polish letters drawn.
- typecheck, ESLint and the language gate green in the pre-commit hook.
