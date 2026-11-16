# Plan review: marketing-kit-segment-camera

- Backward compatibility (Critical, accepted): every new field is optional; the picture's `tl.set` gains
  `transformOrigin` only when the film has a camera, and the existing tests pass unchanged apart from the fade tail's
  new `origin` field.
- Draft and render alike (Warning, accepted): both use `power1.out` (`1 - (1 - t)^2`) and the same move length in
  frames; a test pins the draft expression and the render tween of the same camera.
- A fade into a tighter framing (Warning, accepted): documented and clamped at 1 in the picture; the app avoids it.
- Verdict: approve.
