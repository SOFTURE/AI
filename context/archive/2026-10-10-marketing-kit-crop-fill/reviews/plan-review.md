# Plan review: marketing-kit-crop-fill

Reviewed plan.md against change.md, issue #371 and `screenshot.ts`, `steps.ts`, `shot-steps.ts` on master. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Stretching after the frame is computed would let a card at the page's end be refused as "past the bottom" before it could grow. | Accepted: the target is stretched first and the frame computed from the new measure. |
| F2 | Warning | `display: flex` on the target turns its children into flex items; with `align-items` left at `stretch` they keep the full width, so a block layout reads the same. | Accepted: no `align-items` is set. |
| F3 | Suggestion | `min-height` beats `height` and `max-height`, so a page stylesheet cannot cap it; the gate only catches targets that are not HTML elements or a script reset. | Accepted: the gate stays as a cheap second line, tested with an SVG. |

No finding blocks the plan.
