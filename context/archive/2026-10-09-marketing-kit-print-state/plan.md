# Plan: marketing-kit-print-state

Input: change.md (research and framing skipped, reasons there). Complexity: small to medium (one phase).

## Today (master `4af1614`)

- **Hiding.** `app.hideSelectors` is global: `takeShot` injects one `<style>` per selector (`display:none!important`)
  on `DOMContentLoaded` through an init script. Nothing checks the selectors took effect.
- **Crop.** `crop: { target, aspect, padding }`; `measureCrop` reads the target's document rectangle and
  `findCropFrame` frames "as wide as the element plus padding, from the padding above its top edge".
- **Steps.** `shotStepSchema` is a discriminated union on `do`: `fill`, `click`, `check`, `press`; `runShotSteps`
  turns a Playwright failure into `steps[i] (<do>): <first line>` (gate `steps`). The same steps serve `signIn.steps`.
- **Gates.** `SCREENSHOT_GATES` (exported from the package index): sign-in, load, status, steps, scroll, phrase,
  crop, size, duplicate.

## Goal

`@softure-ai/marketing-kit` 0.1.11 with the three points of #333.

**Out of scope:** a generic CSS block per entry (selectors cover the issue; free CSS would bypass the selector check
that keeps `marketing.json` from injecting arbitrary rules); `keepFirst` or other slicing beyond `keepLast`.

## Key decisions (auto)

- **(1) `screenshots[].hide`**: CSS selectors (same pattern as `app.hideSelectors`), default `[]`. Injected with the
  app's selectors, one `<style>` each. New gate **`hide`**, after the phrase gate and the crop measurement, before the
  capture: for each selector, the elements that match and are rendered (`checkVisibility` with opacity and
  visibility, a non-empty box) and intersect the captured frame (the crop frame; the whole document with `full`; the
  viewport otherwise) are counted; any count above 0 refuses the shot naming the selector and the count. A selector
  the browser cannot parse is refused by the same gate. A selector that matches nothing passes (a card without a
  `<summary>`). The frame, not only `crop.target`, because the frame can show more than the target (padding, a tall
  aspect, `crop.top`).
- **(2) `crop.top`**: an optional locator descriptor, exactly one match like `target`. The frame's x and width stay
  the target's; its y is the top element's top edge minus `padding`. Refused (gate `crop`) when the top element's top
  edge lies outside the target's vertical span: the frame would no longer show the target.
- **(3) steps** `open` and `hide`:
  - `{ "do": "open", "target": … }` sets `open` on every match (all of them, `nth` picks one). Fails when nothing
    matches within the step timeout, when a match is not a `<details>`, or when a match did not stay open (an
    exclusive accordion with `name`).
  - `{ "do": "hide", "target": …, "keepLast": N }` (`keepLast` 0-1000, default 0) sets `display:none !important`
    inline on every match but the last N. Fails when nothing matches, or when there are no more matches than
    `keepLast` (nothing would be hidden: a wrong selector). The footnote under the chart goes into the entry's `hide`.
- Version 0.1.11, CHANGELOG, README (screenshots section, gate table, config table, upgrade notes), regenerated
  `schema/marketing.schema.json`.

## Tests first

- `tests/shot-parts.test.ts`: `findCropFrame` with `top` (frame from the top edge, refusal above and below the target).
- `tests/screenshot.test.ts` (Chromium, a new fixture `print.html`): entry `hide` hides an element and passes; the
  `hide` gate refuses an element that stays visible (inline `!important`) in the frame and writes no file, and passes
  one outside the frame; an unparsable selector is refused; `crop.top` frames from the row; `open` opens every
  `<details>` (phrase inside the last one passes), refuses a non-details match; `hide` with `keepLast` keeps the last
  N columns, refuses `keepLast` ≥ matches.
- `tests/config.test.ts`: the new keys parse with defaults; bad `keepLast`, bad selector refused.

## Progress

- [x] tests red (19 failing before the change)
- [x] implementation green (marketing-kit: 629 passed, 2 skipped)
- [x] docs, version 0.1.11, regenerated schema
- [x] gates: typecheck, lint, test, build
