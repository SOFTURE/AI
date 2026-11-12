# Plan review: marketing-kit-ribbon-captions

- Backward compatibility (Warning, accepted): the fit script's selector widens to also reach the ribbon; for the
  other styles it still matches the same `p`, so their HTML only changes in that script line. Tests assert it.
- Draft and render line breaks (Warning, accepted): the render wraps in the browser, the draft by the measured font,
  as the highlight pill already does; frame grabs compare them.
- Rotation and entrance (Warning, accepted): the turn sits on the caption box, the entrance tween on the `p`, so GSAP
  never overwrites the turn.
- Verdict: approve.
