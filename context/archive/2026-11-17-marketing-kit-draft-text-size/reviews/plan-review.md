# Plan review: marketing-kit-draft-text-size

Reviewed against change.md, research.md and the code (`draft.ts`, `draft-overlays.ts`, `hand-font.ts`,
`overlay-html.ts`, `compose.ts`).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Phase 3 wraps a keyword with `\N` but its typing steps hide the rest with `HIDDEN` text: the hidden part must carry the same `\N` or the shown part reflows. | Accepted: break the text once into lines, join with `\N`, and type over the joined text (the line break counts as no character). |
| 2 | Warning | The regression test compares ink boxes; a card shadow in the render (`box-shadow`) would count as ink. | Accepted: the test hides shadows and borders in the page (`box-shadow:none`) and gives the draft no brand style. |
| 3 | Suggestion | Keep the default path without `fonts` unchanged, so the adopting app's previews do not shift twice. | Already in the plan. |
| 4 | Warning | A role font whose family equals the body's is skipped today (`roleFonts`), yet its metrics may differ only by file; the set must still give each role a `DraftFont`. | Accepted: roles without their own file use the body's `DraftFont`. |

Verdict: ready to implement with the fixes above.
