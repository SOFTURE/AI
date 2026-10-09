# Implementation review: marketing-kit-print-state

Reviewed: the branch against plan.md (Key decisions, P1-P3 of the plan review) and issue #333, by reading the diff
of `tools/marketing-kit` adversarially. Mode: autonomous; every finding decided.

## Against the plan

| Plan item | Where | Verdict |
| --- | --- | --- |
| `screenshots[].hide`, injected with `app.hideSelectors` from the first paint | `src/config/schema.ts`, `takeShot` | done |
| Gate `hide` over the captured frame (crop frame, whole page with `full`, viewport), after steps and the phrase gate (P1, P2) | `countShownHidden`, `findHideFailure`, `captureLoadedPage` | done; the stubborn inline `!important` button is refused, an element below the frame passes |
| Unparsable selector refused by the gate | `countShownHidden` | done (`button:bogus`) |
| `crop.top`: one match, frame from its top edge, refused outside the target | `measureCrop`, `findCropFrame` | done; a pixel test proves the frame starts at the row, not at the card |
| Step `open` on every match, refuses non-details and an exclusive group (P3) | `openEvery` in `src/screenshot/steps.ts` | done |
| Step `hide` with `keepLast`, refuses when nothing would be hidden | `hideAllButLast` | done |
| Version 0.1.11, CHANGELOG, README (gate table, config table, new section, upgrade notes, install pin), schema | | done |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Warning | The first pixel probe of the `crop.top` test hit the row's white text and read like a stripe; the test would pass or fail for the wrong reason. | Fixed: the probe reads the row right of its text. |
| R2 | Warning | A selector with a pseudo-element (`summary::marker`) matches nothing in `querySelectorAll`, so the gate cannot judge it and passes it. | Kept: the rule still hides what CSS allows; the README says a selector that matches nothing passes. |
| R3 | Suggestion | The `hide` step sets inline style only on HTML and SVG elements. | Kept: charts are HTML or SVG. |
| R4 | Suggestion | A client re-render after the `hide` step can bring the columns back before the capture. | Kept: the same holds for any step; `waitMs` and the phrase gate already cover a page that is still rendering. |

## Tests seen red

- every new test before the implementation (19 failures across config, options, shot-parts and screenshot);
- the `crop.top` pixel probe (R1) until the probe point moved.

## Verdict

Ready to merge.
