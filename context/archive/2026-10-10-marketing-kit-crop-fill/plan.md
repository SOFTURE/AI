# Plan: marketing-kit-crop-fill

Input: change.md, issue #371 (research skipped, reason in change.md). Complexity: small (one phase).

## Goal

An entry frames one row of a card at a fixed aspect when the visible card is shorter than the frame, with nothing of
the page below it and no border above the row.

## Decisions (auto)

- **Proposal 1 (`crop.fill`), not proposal 2 (per-entry style list).** Keeps the "no arbitrary CSS" stance; the issue
  says either is enough.
- **`crop.fill` (boolean, default false).** Before the frame is computed, a target shorter than the frame minus the top
  padding gets inline `!important` styles: `box-sizing: border-box`, `min-height` (frame height minus padding),
  `display: flex`, `flex-direction: column`, `justify-content: center`. The target is measured again, so a page that
  grows with it is still checked against its bottom edge. The `crop` gate refuses the file when the target still ends
  more than 1 px above the frame's bottom (an SVG target, a script resetting its style).
- **`crop.fill` excludes `crop.top`** (config refusal): centring moves the row the frame would start at.
- **Border: a step `flatten`** (`border-top: none`, `margin-top: 0`, `!important`, every match), in line with `open`
  and `hide`: the entry-level `hide` list cannot express it, and a step can target the list the row sits in. Fails
  when nothing matches, like the other every-match steps.
- **Version.** 0.1.12: package.json, lockfile, README install line and upgrade notes, CHANGELOG.

## Phase 1: schema, capture, step, tests, docs (test-first)

- Tests: config accepts `fill` and `flatten`, refuses `fill` with `top` and `keepLast` on `flatten`; Playwright
  against `tests/fixtures/screenshots/row.html`: without `fill` the next card shows at the frame's bottom; with `fill`
  the frame is 716×596, the card's colour reaches the bottom edge, the row sits in the middle with no border above it;
  an SVG target is refused by the `crop` gate; `flatten` drops the border and margin with `!important`.
- Docs: README (steps list, gate table, frame section, interactive card example, upgrade notes), CHANGELOG 0.1.12,
  regenerated `schema/marketing.schema.json`.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1: schema, capture, step, tests, docs
