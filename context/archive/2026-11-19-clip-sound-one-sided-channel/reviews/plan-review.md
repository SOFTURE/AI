# Plan review: clip-sound-one-sided-channel

Verdict: proceed.

- The fold must also reach the measuring pass, or the pre-gain is measured on the left-only sound (3 dB low): covered
  in Phase 1.
- Balanced clips must keep their arguments exactly so existing caches and tests hold: covered (optional `balance`,
  no filter for `balanced`).
- `prepareClipSounds` runs for b-roll too: the measure runs for every clip with sound, not only talking ones: covered.
- No migration, no new dependency, no public API removed (additive exports only): patch release.
