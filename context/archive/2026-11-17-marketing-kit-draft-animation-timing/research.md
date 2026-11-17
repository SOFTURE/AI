# Research: marketing-kit-draft-animation-timing

## Cause found (probe, Chromium + GSAP 3 against the draft's ASS, a counter of 2.5 s to 2800, a typed strip)

- **`OVERLAY_EASES` are not GSAP's curves.** The kit models `power2.out` as `1 - (1 - t)^2`, `power3.out` as
  `1 - (1 - t)^3` and `power2.in` as `t^2`. GSAP's `powerN` is a polynomial of degree N + 1: `power2.out` is
  `1 - (1 - t)^3`, `power3.out` is `1 - (1 - t)^4`, `power2.in` is `t^3` (`power1` is the quadratic). Every draft
  value derived from these curves therefore lags the render: the counter (power2.out), a dropped letter's fall
  (power2.out), the list card's growth (power3.out), a pop's scale. Probe at 1.05 s into a 1.25 s count: render
  2789, draft 2734 (the adopting app saw 2797 vs 2734 one frame grab later).
- **The draft's counter steps every 0.1 s and shows each step's end value from its start**, with
  `round(duration / 0.1)` steps that need not fill the count's duration (1.25 s gives 13 steps over 1.3 s).
- **Typing:** the render staggers letters by `r3(1 / speed)` (0.071 s at 14 per second); the draft places them at
  `index / speed` (0.0714 s) and starts a second line at `start + before / speed`. Over a strip's 18 letters the
  render runs 8 ms ahead, and a letter shows over a 10 ms fade in the render: within a frame but not the same
  function. The note's tick time (`timeNote`) and a title's highlight marks use `/ speed` as well.
- **Wipe:** the render tweens the card's clip and the accent panel along `power3.out` (in) and `power2.in` (out);
  the draft's `\t` interpolates the clip linearly, so mid-wipe the draft's card is far less open (at a quarter of
  the grow: render 68 %, draft 25 %).
- Entrance tweens (fade, slide, pop) in the draft are already approximations (`FADE_IN_MS`, `\move` linear);
  they settle within their 0.25 to 0.5 s and are not states a frame grab compares; left as they are.

## Files
- `src/footage/overlay-motion.ts` (eases, shared helpers), `overlay-html.ts` (typing stagger, counter seconds),
  `draft-overlays.ts` (counter steps, typed line starts, wipe clips), `overlays.ts` (`timeNote`).
- Tests: `overlay-motion.test.ts`, `draft.test.ts` (pinned ASS), a new browser test against Chromium + GSAP.
