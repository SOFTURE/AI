---
change_id: marketing-kit-render-crf-1036
verdict: approved
---

# Implementation review: marketing-kit-render-crf-1036

Reviewed 5a8209b..bc970b2 against plan.md and issue #1036.

- `RenderFootageOptions.crf` reaches `getHyperframesRenderArgs`, which adds `--crf <n>` right after `--quality`;
  `renderFootage` passes the whole options object, so no other wiring is needed.
- Validation: a non-integer or a value outside 0-51 throws with the value, as hyperframes would reject it later.
- Without `crf` the arguments are byte for byte as before (existing test unchanged and green).
- The preset half of the issue is documented as out of reach (no hyperframes flag), with `draft` + `crf` as the
  route and its JPEG 80 capture stated.
- README and CHANGELOG `## Unreleased` updated; no version bump.
- Approved.
