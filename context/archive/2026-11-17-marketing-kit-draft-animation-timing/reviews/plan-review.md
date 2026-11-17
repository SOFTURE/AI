# Plan review: marketing-kit-draft-animation-timing

Reviewed against change.md, research.md and the code (`overlay-motion.ts`, `overlay-html.ts`, `draft-overlays.ts`,
`overlays.ts`).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | Phase 1 changes curves the render does not read (it names GSAP eases) but every draft step reads: pinned ASS in `draft.test.ts` and `getDropOffsetAt`/`getEntranceScaleAt` tests will move. | Accepted: update the pinned values in the same phase and say why in the commit. |
| 2 | Warning | Counter steps per frame must sit on the film's frame grid, not on the count's start, or a frame grab lands mid-step. | Accepted: steps are built from film frame indices (`round(t * fps)`), each event spanning frame ± half a frame. |
| 3 | Warning | A GSAP seek without events (`seek(t)`) skips `onUpdate`, so a browser test would read the counter's first value. | Accepted: the regression test seeks with events (`seek(t, false)`), as a frame capture renders. |
| 4 | Suggestion | Typed centred text hides its untyped letters; its line offset must still count the previous lines' letters. | Accepted: `firstIndex` is the letters typed before the line, as now. |

Verdict: ready to implement with the fixes above.
