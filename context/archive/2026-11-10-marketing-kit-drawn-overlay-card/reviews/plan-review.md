# Plan review: marketing-kit-drawn-overlay-card

Verdict: approve.

- Contract: `getDrawnOverlayCard` reads only resolved fields (`box`, `fontSize`, `side`, text), so placement is
  untouched; the draft calls it, so report and drawing cannot drift. OK.
- Risk: the estimate (0.56 em per character) can be narrower than a wide font's text; the padding (0.6 em each side)
  absorbs the usual error, and the other cards already rely on it. Accepted, named in Decisions.
- Tests: exact ASS events plus one burned frame cover the drawing; the function's branches (right, left, list, cap,
  other kind, punch-in) each have a case. OK.
- Release: minor, `tools/deploy` dev range must take it, or its install breaks. Added as step 4.
