# Plan review: marketing-kit-caption-ranges

- Warning (accepted): an overlay band as a union may stop a text overlay from fitting; documented in the plan's
  decisions, the app avoids it by not laying ranges under overlays. Fix: none in the kit.
- Suggestion (accepted): validate ranges with the same caption bounds as segments, so a range can never push a card
  out of the frame. Applied to Phase 1.
- Checked: no other caller reads `segments[].caption` for placement (`grep applySegmentCaption`): `getSegmentCaptionLayout`
  stays per segment for the end card and logo, unaffected.

Verdict: ready to implement.
