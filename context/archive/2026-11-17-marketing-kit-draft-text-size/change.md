---
change_id: marketing-kit-draft-text-size
title: "marketing-kit: the footage draft draws every font at the render's size and breaks its lines as the render does"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-draft-text-size
created: 2026-11-17
updated: 2026-11-17
---

## Intent

An adopting app compared a footage draft (540x960, libass) with the paid render (1080x1920, Chromium) of the same
cut and found every text drawn in an uploaded brand font about 30 to 35 % smaller in the draft: a place card title
0.64x as wide, a caption on one line in the draft and two in the render, counter digits 1.5x taller in the render.
The handwriting matched. The draft is meant to be the render at half resolution, so an owner who accepts a draft
accepts the render. The kit should draw every font in the draft at the size the render draws it (in proportion to
the frame) and break captions and overlay texts into the same lines.

## Context

- The draft writes an ASS file (`draft.ts` captions, `draft-overlays.ts` overlays) that libass burns in; the render
  draws the same resolved overlays (`overlays.ts`) as HTML (`overlay-html.ts`, `compose.ts`).
- libass sizes a font the VSFilter way: `usWinAscent + usWinDescent` is the font size (`draft-text-width.ts` says
  so). The hand font is converted (`getHandFontAssSize`), every other font is passed as CSS px.
- An adopting app builds its own preset previews from `buildFootageDraftCaptions`; the new font set must be usable
  there.

## Constraints

- One way to size and measure a draft font for both paths: sizes in CSS px everywhere, converted to the libass size
  only where an ASS size is written.
- Fixtures only: the kit's DejaVu Sans Bold and Caveat (both with their licences in `fonts/`).
- No change to the render's output.
- Card shapes, highlight bands and vertical text placement (`box_percent` parity) are the follow-up change of the
  same adopting roadmap; this change keeps the draft's cards as they are, except where a line break changes a card's
  text.

## Notes
- Research and frame: research done (`research.md`); frame skipped, the adopting app's measurement and the probe
  confirm the stated cause.

## Done
- marketing-kit 0.42.0: the draft draws every font at the render's size and letter spacing and breaks captions and
  side texts into the render's lines (`loadFootageDraftFonts`, `DraftFont`).
