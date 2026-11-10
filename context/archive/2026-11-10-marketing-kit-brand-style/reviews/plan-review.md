# Plan review: marketing-kit-brand-style

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A drawn pill whose width comes from `OVERLAY_CHAR_EM` would not fit the caption text; the pill is on every frame. | Accepted: measure the draft font's advances (`og/text-width.ts`), the estimate only as fallback. |
| 2 | Warning | libass wraps a long chunk itself; the drawn pill would then miss a line. | Accepted: the draft breaks the lines itself and writes `\N`. |
| 3 | Warning | `draft-overlays.ts` and `overlays.ts` change in `overlay-drawn-boxes` at the same time. | Accepted: build on it, release after it (0.26.0). |
| 4 | Suggestion | Overlay padding would move the boxes the draft frames report. | Accepted: left to the card-layout follow-up. |

Verdict: ready to implement.
