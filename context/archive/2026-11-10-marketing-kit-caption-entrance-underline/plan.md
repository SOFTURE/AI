# Plan: marketing-kit-caption-entrance-underline

## Approach
Two film inputs, one place each: the render's caption tweens and CSS (`composeFootage`), the draft's highlight events
(`buildFootageDraftCaptions`), the config schema and its JSON schema, the README and the changelog.

## Phase 1: entrance and underline (test-after)
- `film.ts`: `CAPTION_ENTRANCES = ["none", "fade", "pop"]`, `captionEntrance?`; `CAPTION_HIGHLIGHT_STYLES` gains `underline`.
- `caption-highlight.ts`: look `{ style: "underline", color }`; `CAPTION_UNDERLINE_EM` (thickness, offset); `getCaptionEntranceTween`.
- `compose.ts`: entrance tween per chunk (absent: today's rise); `underline` markup `<i class="ul">` and its opacity tweens.
- `draft.ts`: with a drawn pill, a rounded bar under each lit word per piece (word geometry from the pill's lines and
  the measure); without one, `\u1` in the accent.
- `config/schema.ts`, `config/config.ts`: `captionEntrance` and `underline` from `marketing.json`; regenerate the JSON schema.
- Tests: compose (each entrance's tween, pop's scale never above 1, absent keeps the rise; underline markup and
  tweens), draft (underline bar under the lit word only while lit, at the word's x; the fallback), config mapping.
- Done when: `npm run typecheck`, `npm run lint`, kit tests green.

## Phase 2: release
- Version: the next free minor on npm; changelog and README; release from Actions after merge.

## Progress
- [x] 1.1 entrance and underline in render, draft and config, tests (kit suite 1392 passed; new tests green, browser tests with Chromium)
- [x] 2.1 version 0.29.0 (0.28.0 is taken by a parallel change), changelog, README, deploy peer range; released from Actions after merge
