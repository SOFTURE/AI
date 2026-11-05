---
change_id: marketing-kit-mix-retry-1095
verdict: approved
---

# Implementation review (auto)

- Matches the plan: one pure retry rule (`getNextMixAttempt`, `getLimiterSlope`) and its caller; the first encode is
  unchanged, so a one-encode mix (the adopting app's render check) gets the same gain and ceiling.
- Failing first: the new ffmpeg test failed on 0.12.0's retry (`seed 1: ... after 4 encodes ... true peak -0.7 dBTP`,
  `seed 5: ... integrated -15.2 LUFS, outside`), and passes with the fix.
- The #1085 test's upper bound on the gain assumed the old retry (edge plus less than 1 dB). It now bounds the gain
  above the edge by the limiter's measured cost plus a margin, which is what "into the window, no further" means with
  a limiter that takes loudness back; its other assertions (inside the window, below -14.5 LUFS) are unchanged.
- Guards: the slope is clamped to 0..0.7 (no runaway `1 / (1 - b)`), the limiter's cost never goes below zero (a
  lower gain moves the mix by the gain alone), an empty try list throws as a bug.
- English only, no manifest or lockfile change, exports and CHANGELOG list the changed signature.
- Approved.
