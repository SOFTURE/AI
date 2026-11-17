# Plan: marketing-kit-draft-animation-timing

## Approach
Make the kit's curves GSAP's own, compute every animated value the draft draws from one shared function of the
overlay's time, and step the draft once per render frame where it animates a value (counter, wipe clip).

## Phases
1. **Eases (TDD).** `OVERLAY_EASES` become GSAP's curves (`power2.out` cubic, `power3.out` quartic, `power2.in`
   cubic). Test: each equals `gsap.parseEase(name)` at 101 points. Done when: the test fails on the old curves and
   passes.
2. **Counter (TDD).** `getCounterValueAt(overlay, seconds)` next to `getCounterSeconds` (the render's tween's value
   at a second); the draft writes one step per render frame (`FOOTAGE_FPS`), each showing the value at its frame
   and spanning half a frame either side, so centisecond rounding never moves a frame into the wrong step. Done
   when: unit tests pin the steps and the value function against GSAP.
3. **Typing (TDD).** `getTypingStep(speed)` (the render's stagger, `r3(1 / speed)`) and
   `getTypingTimes(start, text, speed, firstIndex)`; the render's stagger, its marks, the draft's line starts and
   `timeNote`'s last letter all use them. Done when: tests pin that a second line continues the first's times.
4. **Wipe (TDD).** The draft's wipe clips (card, text, accent panel, wipe exit) move along the render's ease in one
   `\t` per render frame (`getEasedTransforms`). Done when: unit tests pin the clip at each frame against the ease.
5. **Regression test (`tests/draft-animation-timing.test.ts`).** A fixture film with a counter, a typed strip, a
   typed title and a wiped keyword; the render's composition in Chromium seeked with events, the draft's ASS read
   at the same seconds: at 5 or more seconds each the counter's value and the typed letters agree within one
   render frame (the draft's state lies between the render's one frame before and one frame after). Fails on
   master's code.
6. **Wiring.** README, CHANGELOG, version 0.43.0, release.

## Progress
- [x] 1 Eases: `OVERLAY_EASES` are GSAP 3's curves (power2.out cubic, power3.out quartic, power2.in cubic, expo.out
  GSAP's own); test against `gsap.parseEase` at 101 points, red on the old curves (power2.out at 0.01: 0.0199 vs
  0.0297). A pop's pinned scale moved with it.
- [x] 2 Counter: `getCounterValueAt`, `COUNTER_EASE`, `getFrameSteps`; the draft's counter is one step per frame
  (the pinned ASS in `overlay-kinds.test.ts`: 45 steps, 412 at 5.167 s).
- [x] 3 Typing: `getTypingStep`, `getTypingTimes(start, text, speed, firstIndex)`, moved to `overlay-motion.ts` (so
  `overlays.ts` uses them without a cycle) and re-exported from `overlay-html.ts`; render stagger, marks, the draft's
  line starts and `timeNote` use them.
- [x] 4 Wipe: `getEasedClipTags`, one `\t` per frame for the card, the text, the accent panel and a wipe exit.
- [x] 5 `tests/draft-animation-timing.test.ts`: 6 counter, 9 typed and 7 wipe moments, 22 passed; with master's
  `src/` 9 fail (counter at 2.7, 3.0, 3.25 s; every wipe moment from 13.1 s). Evidence (not committed): the adopting
  app's project files `draft-matches-render/draft-animation-timing-matches-render/01..03-…-{before,after}-1080-light.webp`.
- [x] 6 Wiring: exports, README, CHANGELOG, version 0.44.0 (0.43.0 is the adopting roadmap's card-shape change,
  released first), deploy's devDependency range. Gates: `tsc` clean, ESLint clean, language gate clean, the kit and
  repository tests green except the ffmpeg loudness tests that time out at 5 s in this container on master too.

## Decisions (auto)
- Entrance fades, slides and pops keep their ASS approximations (they settle before any state is compared); only
  values that run over the overlay's life or a whole wipe are stepped per frame.
- The render keeps its 10 ms letter fade; the draft shows a letter from the same time (a sub-frame difference).
