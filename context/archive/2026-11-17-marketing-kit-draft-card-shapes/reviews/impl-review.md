# Implementation review: marketing-kit-draft-card-shapes

Reviewed the diff against plan.md, change.md and research.md.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The first draft drew a highlighted keyword's marks one per line; Chromium draws one block (the mark is a flex item). | Fixed: `getKeywordMarkBlock`, shared by the draft and `getDrawnOverlayCard`; the regression test holds it within 1 %. |
| 2 | Warning | The regression test's regions cut a card taller than its resolved box, so a too-short card could pass. | Fixed: the region is the whole frame (one overlay at a time, no captions). |
| 3 | Suggestion | The counter's per-value cards are many events while it counts. | Kept: runs of one width are merged; at most one card a tenth of a second. |
| 4 | Suggestion | Without `fonts` the old estimated path stays; a test pins it. | Already done. |

Plan drift: none beyond the decisions recorded in plan.md. Verdict: ready to merge after the release step.
