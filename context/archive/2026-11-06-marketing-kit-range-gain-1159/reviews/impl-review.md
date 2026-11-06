---
change_id: marketing-kit-range-gain-1159
verdict: approved
---

# Implementation review (auto)

- Matches the plan: the gain record on purchase, the correction on lay with the measurement fallback,
  `gainDb` per range, `speechGainDb` on both outcomes, the helpers exported.
- The issue's test: a range cached from the un-gained sound and one bought from the pre-gained sound on a quiet clip
  (pre-gain about +18 dB) land within 1 dB of each other and of the sound around them (`isolate-ranges.test.ts`).
- Compatibility: `TranscribeOutcome.speechGainDb` is optional in the type, so an app's own `ready` outcome compiles;
  `LaidRange.gainDb` is optional; cache keys are unchanged.
- Gates: typecheck, lint, language gate, the pre-push suite; CI green on PR #1164 (c2cab5b).
- Approved.
