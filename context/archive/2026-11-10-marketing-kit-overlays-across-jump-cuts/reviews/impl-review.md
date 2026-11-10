# Implementation review: marketing-kit-overlays-across-jump-cuts

Verdict: approved.

- Matches the plan; the refusal names the cut, the reason and the segments the overlay may span.
- Edge cases covered by tests: the last segment (the cut's end), Ken Burns on either side, a caption box moved on
  either side and the same moved box on both, a punch-in that fits and one that does not.
- No drift into drawing code; the generated schema is in step with `edl.ts`.
