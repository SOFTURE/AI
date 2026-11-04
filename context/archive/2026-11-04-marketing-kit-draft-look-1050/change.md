---
change_id: marketing-kit-draft-look-1050
title: "marketing-kit: the footage draft follows the film's caption style, brand and music (issue #1050)"
status: archived
roadmap_item: null
issue: 1050
branch: claude/project-thread-v6vc96
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1050](https://github.com/SOFTURE/AI/issues/1050). An adopting app shows the owner the free footage draft
(`renderFootageDraft`) as "what the render will give", but the draft always draws plain white phrases in DejaVu Sans
and plays no music. After this change:

1. `RenderFootageDraftOptions.brand?` (the `FootageBrand` the render takes): the captions use the brand's body font
   (an SFNT file copied to the draft's `fonts/`) and caption colours;
2. `buildFootageDraftCaptions` follows `film.captionStyle`: `phrase` as before; `highlight` draws the render's chunks
   (up to four words) in an opaque box of `captionBackground`, words in `captionText`, the word being said in
   `captionHighlight`, for the render's 0.32 s;
3. `RenderFootageDraftOptions.cacheDir` / `providers`: a `file` music source plays, a `prompt` / `video` source plays
   only from the paid cache, ducked, looped and faded as in the render; never a paid call. The result says
   `music: "none" | "played" | "not_cached"`, and the log says why;
4. README "Footage draft" lists what the draft matches and what it still leaves out.

## Context

Labels: `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{draft,pipeline}.ts`, a new
`src/footage/draft-font.ts`, the draft tests, README, CHANGELOG. The draft shipped in 0.6.0 (#1018), threads in
0.7.0 (#1024).

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.
- New options are optional: a call without them draws what it drew before.

## Notes

- Framing: skipped. The issue names the gap and the options to add.
