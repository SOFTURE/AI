# Implementation review: marketing-kit-declick-repair-1170

Verdict: approved.

- Point 1: the default stays `off`; the gate (15/20 dB on transcript gaps) is gone from both levels.
- Point 2: `getRepairZones` keeps ±80 ms clear of every word; an impulse is repaired only when it fits a zone with its
  3 ms crossfades; the repair is least-squares AR interpolation (Burg fit on 10 ms each side, banded Cholesky solve),
  no gain is applied anywhere, and the report lists every repair's start and end.
- Point 3: the envelope test (5 ms RMS inside word ± 80 ms, ≤ 1 dB in 99.9 % of frames, transcript spans 30 ms and
  60 ms narrower than the sound) failed on the old stage for both levels and passes now; a further test checks that
  only the repairs with their crossfades differ from the input, and the ffmpeg round trip returns the speech
  sample-exact.
- Interpolation quality: a two-tone signal through a click comes back within -36 dB of the clean signal.
- Gates: `npm run typecheck`, ESLint on the changed files, the language gate, marketing-kit and repository tests.
