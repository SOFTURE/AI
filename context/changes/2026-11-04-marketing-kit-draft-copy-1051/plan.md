---
change_id: marketing-kit-draft-copy-1051
status: active
---

# Plan: the draft film's picture copied in the final pass (issue #1051)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the publishable profiles (TDD)

Files: `src/footage/publish.ts` (+ test), `src/footage/pipeline.ts`, `src/cli/footage.ts`.

- `PUBLISHABLE_H264_PROFILES = ["Constrained Baseline", "Main", "High"]`; `isPublishableVideo` takes H.264 yuv420p in
  any of them. A picture outside them is still re-encoded to H.264 High at `medium` CRF 18.
- `findFinishProblems` names the accepted profiles in its message.
- The finish log line says `H.264` with the film's profile instead of a fixed `H.264 High`; the CLI summary says
  `H.264`.
- Tests: Constrained Baseline and Main are copied; Baseline, High 10 and yuv422p are re-encoded; the problem message.

## Phase 2: docs

README ("Publishable output", "Encoder speed": the final pass now copies the draft film, the issue's numbers),
CHANGELOG `## Unreleased`.

## Decisions (auto)

- Option 1 of research.md: widen the publishable profiles; no tier-matched preset in the final pass.

## Progress

- [ ] Phase 1: the publishable profiles
- [ ] Phase 2: docs
