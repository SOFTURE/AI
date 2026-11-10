# Implementation review: marketing-kit-drawn-overlay-card

Verdict: approve. No drift from the plan.

- Correctness: the card's right edge equals the box's for a right side (asserted), the left edge for a left side; a
  long keyword is capped at the box. The slide entrance moves card and text together (asserted on the lower third).
- Typed keywords: the card shows for the whole span and fades in once; the text types over it (asserted).
- Clean-up: the `Overlay` style and the card flag of `getTextTags` had no other user; removed.
- Gates: typecheck, lint and the marketing-kit tests green before the commit.
