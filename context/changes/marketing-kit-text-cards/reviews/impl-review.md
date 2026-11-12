# Implementation review: marketing-kit-text-cards

Verdict: approve.

- Plan drift: none beyond the two recorded decisions (font-measured handwriting, wider strip measure), both found by
  looking at libass frames of the draft.
- Tests: `overlay-text-cards.test.ts` covers the schema bounds and refusals, the drop motion (never below the line, no
  rise back), note placement, speech timing (said, partly said, not said, late, reordered), the tick, the end word and
  the title band, the render markup and tweens, the draft events, and libass frames (paper and ink, only the words said
  so far, the tick, the end word in white, the highlight mark). Kit suite: 1509 passed, 72 skipped (browser renders).
- Existing messages that changed are listed in the CHANGELOG.
- `tests/repo/deploy-workflows.test.ts` needs `ssh-keygen`, absent in this container; it fails the same way without the
  change and runs in CI.
