# Implementation review: marketing-kit-crop-fill

Reviewed the diff against plan.md and change.md. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Suggestion | `crop.fill` on a target already as tall as the frame does nothing; a config could carry it by habit. | Kept: harmless, documented ("left as it is"). |
| F2 | Suggestion | `flatten` touches only the top edge; a row with a bottom divider keeps it. | Kept: the issue's stray line is the top border; the bottom one belongs to the card. |

Acceptance (change.md): 1 by the Playwright tests (frame size, the card's colour at the bottom edge, the row in the
middle; without `fill` the next card shows); 2 by the `flatten` step test and the pixel above the row; 3 by the README
example under "A still image of an interactive card".

Gates: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
