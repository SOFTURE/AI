# Plan review: marketing-kit-print-state

Reviewed plan.md against issue #333 and the code it names. Mode: autonomous; every finding decided.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Warning | Hidden elements are `display:none`, so the gate only catches rules that lost (an inline `!important`, an unparsable selector dropped by the browser). Checking only "inside `crop.target`" would miss an element the frame shows outside the target. | Accepted as planned: the gate checks the captured frame. |
| P2 | Warning | The gate must run after the steps: a step can reveal an element (opening `<details>` shows its contents) that matches a hidden selector. | Accepted: the gate runs right before the capture, after steps, scroll and the phrase gate. |
| P3 | Warning | Setting `open` on several `<details>` of one exclusive accordion (`name` attribute) closes the others, so "open every match" would silently leave all but one closed. | Accepted: the step re-reads `open` and fails naming how many did not stay open. |
| P4 | Suggestion | `hide` with `keepLast` larger than the matches could be a valid empty account. | Kept as a failure: the shots show a seeded account, so too few matches means a wrong selector. |
| P5 | Suggestion | `open`/`hide` are also accepted in `signIn.steps`, where they are of little use. | Kept: one step schema; harmless there. |
| P6 | Suggestion | A new gate name extends the exported `SCREENSHOT_GATES`; a consumer switching on it exhaustively gets a type error. | Accepted as a CHANGELOG line. |

## Verdict

Ready for implementation with P1-P3 in the Key decisions.
