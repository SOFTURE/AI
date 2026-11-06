# Plan review: marketing-kit-isolation-min-length-1140

Verdict: approved (auto).

- Covers every point of the issue: provider minimum (1), merge, widen and trim back (2), estimate prices only what is
  sent and marks the rest (3), no work file after a refusal (4). Point 4's "never retried" is met for too-short input
  by not sending it; classification of other deterministic refusals is #1141's, recorded under Decisions.
- Compatibility: `heard`, `skip`, `minSeconds`, the new options and the `skipped` outcome are additive; the default
  merge changes cache keys, documented with the opt-out.
- Risk: a widened range overlapping a neighbour; handled by the second merge. Heard spans of merged ranges never
  overlap, so the switch logic only applies with `mergeGap: null`, as before.
- Tests: pure planner tests for merge, widen at clip edges, skip; the acceptance test through ffmpeg and the fake.
