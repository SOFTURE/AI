---
change_id: marketing-kit-draft-look-1050
status: in_progress
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

- [ ] Phase 1: brand font and caption styles
- [ ] Phase 2: music from the cache
- [ ] Phase 3: docs
