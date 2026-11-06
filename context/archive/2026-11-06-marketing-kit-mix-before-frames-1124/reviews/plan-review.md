---
change_id: marketing-kit-mix-before-frames-1124
verdict: approved
---

# Plan review (auto)

- Scope matches change.md: the four asks of the issue map to phases 1-3; no manifest, no lockfile.
- The approach is measured, not assumed: research.md simulates it on the issue's fixtures (0 failures, ≤ 2 encodes)
  against today's 3-4 encodes or failure. The acceptance asks for a test that fails before the fix.
- Risk: the mix built by ffmpeg may differ from hyperframes' (sync, volumes). The cues come from the same function
  the composition uses, everything starts at 0 and is trimmed to the film's length; the ffmpeg draft already mixes
  speech and music the same way.
- Risk: uncompressed probes cost time on long films; they decode only the audio and are capped at 6 per solve.
- Risk: the low-pass changes the sound; at 16 kHz on speech it is inaudible for the target platforms, and it is the
  measured cause of the bounded overshoot.
- Approved.
