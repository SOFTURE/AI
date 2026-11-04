---
change_id: marketing-kit-draft-copy-1051
verdict: approved
---

# Implementation review: marketing-kit-draft-copy-1051

Reviewed e9d555b..76f9230 against plan.md and issue #1051.

- `isPublishableVideo` takes H.264 yuv420p in `PUBLISHABLE_H264_PROFILES` (Constrained Baseline, Main, High); a
  null profile, plain Baseline, High 10, 4:2:2 and other codecs are still re-encoded to High at `medium` CRF 18.
- `buildFinishArgs`, `finishFootage`'s copy decision and the post-check `findFinishProblems` share the predicate, so
  a copied draft film passes the check and nothing else newly passes.
- An ffmpeg test renders like the `draft` tier (`ultrafast`, ffprobe: Constrained Baseline) and sees
  `finish: streams copied to H.264 Constrained Baseline`; it and the unit tests failed before the change.
- Log and CLI texts no longer claim High for a copied film. README and CHANGELOG `## Unreleased`; no version bump.
- Approved.
