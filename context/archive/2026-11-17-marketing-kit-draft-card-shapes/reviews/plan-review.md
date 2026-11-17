# Plan review: marketing-kit-draft-card-shapes

Reviewed against change.md, research.md and the code (`overlays.ts`, `draft-overlays.ts`, `overlay-html.ts`,
`draft-text-width.ts`).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A typed keyword types over `\N`-joined text; drawn as one event per line, each line must start typing after the characters of the lines before it. | Accepted: per-line typing offsets as the hook title already does. |
| 2 | Warning | The wipe clips to the card; with the taller card the clip must follow it or line 2 stays hidden. | Accepted: the motion takes the layout's card. |
| 3 | Warning | `getDrawnOverlayCard` without a measure must keep its answer byte for byte (callers store boxes). | Accepted: a test pins the old answer. |
| 4 | Suggestion | A counter's box report: use the final value (its widest), as `measureCounter` does. | Accepted. |
| 5 | Warning | `DraftFont` is an exported interface: new fields optional, so a caller's own fonts still type-check. | Accepted. |

Verdict: ready to implement with the fixes above.
