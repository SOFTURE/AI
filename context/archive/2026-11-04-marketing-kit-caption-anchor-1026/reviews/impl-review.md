---
change_id: marketing-kit-caption-anchor-1026
verdict: approved
---

# Implementation review: marketing-kit-caption-anchor-1026

- Scope matches the plan: `bottom` in `CaptionLayout`, the override schema and all three consumers (screen-recording
  composition, footage composition, footage draft); the presets anchored by their foot; `captionMaxLines` in the film
  type, schema and config; metrics exported; README, CHANGELOG and the generated schema updated. No version bump.
- Compatibility: the layout tables and the existing snapshots are unchanged (no `bottom` key unless given); the only
  visible change without new options is the preset films' captions, recorded in the CHANGELOG.
- Correctness: the fit script resets the inline size before each pass, so the second pass after fonts load starts
  from the box's size; the loop ends at the floor. The browser test pins both the premise (3 lines) and the result.
- Tests assert exact CSS, the ASS style line, schema refusals and the browser measurement; names state behaviour.
- Approved.
