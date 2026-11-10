# Plan review: marketing-kit-overlays-across-jump-cuts

Verdict: approved.

- Only refusals become acceptances; every EDL that resolved before resolves the same, so no stored cut changes.
- The draft and the render draw non-punch-in overlays on film time (`buildDraftOverlayEvents`, `composeFootage`), so
  an overlay spanning segments draws without change. Checked: the punch-in is the only segment-bound kind.
- Timing checks (one at a time, spacing, hook title) work on film time and need nothing new.
