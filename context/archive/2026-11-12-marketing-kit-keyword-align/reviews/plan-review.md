# Plan review: marketing-kit-keyword-align

- Backward compatibility (Warning, accepted): `EdlOverlayStyle.align` widens; a title's resolved `align` stays
  `center | left` because the resolver narrows it and the schema refuses `right` on a title.
- Conflicting knobs (Warning, accepted): `align` with `side` on a keyword is refused rather than silently ranked.
- Reported boxes (Warning, accepted): libass frames compare the drawn card with `getDrawnOverlayCard`.
- Verdict: approve.
