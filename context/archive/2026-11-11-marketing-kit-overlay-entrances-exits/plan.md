# Plan: marketing-kit-overlay-entrances-exits

## Steps

1. `overlay-schema.ts`: `OVERLAY_ENTRANCES` + `pop`, `rise`, `blur`, `wipe` on every card kind; `OVERLAY_EXITS`,
   `OVERLAY_EASINGS`, `OVERLAY_PINS`, `MAX_OVERLAY_SUBTITLE_DELAY`; `style.exit`, `easing`, `stagger`, `subtitle_delay`,
   `pin`, `underline`; overlay `item_words`; each refused on a kind it does not fit. Regenerate `edl.schema.json`.
2. `overlay-motion.ts`: eases as functions, `getEntranceMotion`, `getExitMotion` (auto mirrors; no entrance or `none`:
   the kind's own exit, as before), `getEntranceScaleAt`, `getWipeHalves`, `getListItemStarts`, pin and underline
   constants.
3. `overlays.ts`: `exit`/`easing` on the look only when not default; `underline`, `itemStarts` (words through
   `findWordStart`), `pin` (a taller card by `getPlaceCardPinRow`), `subtitleDelay`.
4. `overlay-html.ts`: tweens from the model; wipe panel and clip-path; staggered points; pin, title, subtitle in
   order (`getPlaceCardTimes`); underline; exits; the soft pill on `power3.out`.
5. `draft-overlays.ts` (+ `draft-boxes.ts` `blurTags`): pop about the card's middle (move with the scale), rise, blur,
   wipe clips and panel, exits (move down only when the card did not move in), staggered points, pin drop, delayed
   title and subtitle, underline.
6. Tests (`overlay-motion.test.ts`): curves, scale never past 1, exits, schema refusals, resolving, exact render
   tweens, draft tags, libass frames (pin → title → subtitle; list points one by one). README, CHANGELOG, 0.31.0,
   `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Schema and JSON schema (`npm run schema`).
- [x] 2 Motion model.
- [x] 3 Resolver.
- [x] 4 Render. Frames of four fixtures grabbed in Chromium with GSAP (pop place card with a dropped pin and delayed
  subtitle, wiped keyword with underline, risen staggered list, blurred snappy counter) and looked at: order and
  motion as planned, no overshoot.
- [x] 5 Draft. The same fixtures burned in by libass and looked at; a list's points stay with their card on a
  rising exit after a fix (no exit move when the card moved in).
- [x] 6 `npx vitest run tools/marketing-kit`: all pass; README, CHANGELOG, version, lockfile.

## Decisions (auto)

- `auto` with no entrance or `none` keeps the kind's own exit, so stored EDLs leave as before.
- The draft's pop is linear (libass `\move` cannot ease), the render's eases; the draft stays a preview.
- A pinned place card's title waits 0.2 s for the pin unless it types (typing already starts later).
- The underline hides the keyword card's static accent edge in the render, so one bar shows.
- 0.31.0: 0.30.0 is reserved by a parallel change; the deploy dev range takes both.
