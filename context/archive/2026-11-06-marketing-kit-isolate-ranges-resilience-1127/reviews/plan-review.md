# Plan review: marketing-kit-isolate-ranges-resilience-1127

Verdict: approved.

- Covers every point of the issue: retries (1), partial result with outcome (2), crossfaded joins (3), per-range
  charge item (4), cache identity for adoption (5, optional) and both acceptance tests.
- The base gain `1 - sum(gains)` keeps the sum at one through a switch between two windows and through a base edge;
  the shared switch interval is what makes that hold, so it is tested in the pure fades test.
- Risk: `aeval` per sample is slower than `volume`; the speech files are seconds to minutes long, acceptable.
- Risk: overlap with the #1126 thread's error shape (`FootageResult`): this change removes one `err` return and keeps
  the other (a broken cached file), so a later kind change applies cleanly.
