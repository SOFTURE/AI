---
change_id: marketing-kit-footage-draft-1018
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (1cff7da).

- Coverage of the issue: draft at a given width with per-input seeks (1), phrase captions over `remapWords` placed by
  the caption preset layout and drawn with a shipped font covering Polish letters (1, 2), zoom, fade and Ken Burns as
  the render draws them (1), the speech track as `buildSpeechArgs` makes it (2), fast start H.264/AAC (1), the machine
  check for libass (2), tests pinning caption timing, zoom crops, `xfade` offsets and the output length (1, 2).
- Sharing `getCaptionSpans` and `getFootageCaptionLayout` with the render keeps the draft from drifting.
- Conflict risk with #1016, #1017, #1019 is limited to export lists, README and CHANGELOG; resolved when master is
  merged in before the merge.
- Risk: `zoompan` jitters slightly on slow zooms; acceptable for a draft.

Verdict: approved, no changes.
