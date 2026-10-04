---
change_id: marketing-kit-desktop-16x9
title: "A 16:9 film can show the desktop app in a browser frame"
status: archived
roadmap_item: FU-15
branch: claude/fu-15-fn0uxc
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

A project whose product lives on the desktop shows it as it is used: a video in `marketing.json` asks for a desktop
device, the recorder opens a desktop browser (a landscape viewport, `isMobile: false`, mouse clicks instead of
touches), and the 16:9 composition frames that recording as a browser window instead of a phone, with the same
captions, persona card and end card. Phone films (every format) compose byte for byte as before. The fixture project
carries a desktop film, and it renders to a 1920×1080 MP4.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-15** (roadmap `followups`, main since 2026-10-03):

> ### FU-15: A 16:9 film can show the desktop app in a browser frame
> - **Change ID:** `marketing-kit-desktop-16x9`
> - **Status:** proposed
> - **Outcome:** A video can ask for a desktop recording: the recorder opens a desktop viewport (`isMobile: false`), and the 16:9 composition frames it as a browser window instead of a phone, with the same captions, persona and end card.
> - **Prerequisites:** FU-16 on `master` (shared files, see Order).
> - **Unknowns:** Whether the scene of a phone film can be reused at a desktop viewport or needs its own scene; how camera focus scales map to a wider screen.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-6 `mk-formats`: 16:9 is a framed phone on the left with copy on the right (frame.md, framing 2 deferred). After: a 16:9 desktop film renders from the fixture project.
> - **PRD refs:** FR-24.
> - **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

The gap is framing 2 of the MK-6 frame ([`frame.md`](../../archive/2026-10-03-mk-formats/frame.md)): "Desktop
recording for 16:9. A second recording per film with a desktop viewport and a browser frame instead of a phone. Cost:
record changes (MK-3's area), desktop scenes per project, a second voiceover timing. Value only for products whose
story is the desktop app." FU-16 ([`archive/2026-10-03-marketing-kit-layout-overrides`](../../archive/2026-10-03-marketing-kit-layout-overrides/change.md))
made the layout table overridable per format and kept `frame`, `phoneBox` and `cameraTarget` fixed. The backlog entry
this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: the recorder's desktop mode in `tools/marketing-kit/src/record/`, a browser-frame layout in
  `tools/marketing-kit/src/compose/`, the device kind in `src/config/schema.ts` and the regenerated
  `schema/marketing.schema.json`.
- Must not touch `src/og/` (FU-23 runs in parallel there).
- The 9:16, 1:1 and 16:9 phone composition snapshots (`tests/snapshots/film-*.html`) stay byte for byte; a phone
  recording log stays frame for frame.
- Every new schema key carries a `.describe()` (`tests/schema.test.ts`); cross-field rules name their path.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent; the owner tags releases.

## Notes

- Placement: roadmap `followups`, item FU-15 (taken from `context/backlog/roadmap-followups/`).
- Research: done (quick depth); it answers the two roadmap Unknowns from the code.
- Framing skipped: this item *is* framing 2 of the MK-6 frame (`archive/2026-10-03-mk-formats/frame.md`), which already
  checked the premise ("It does not hold for a desktop 16:9 video: that is a different recording") and chose to defer
  it; the remaining questions (how a video asks for it, how the browser window is laid out) are design choices inside
  one problem, which research and the plan answer.
- Archived 2026-10-04: a video with `device.kind: "desktop"` (16:9 only) records in a desktop browser (mouse clicks) and composes as a browser window whose address bar shows the end card's URL; `layout.desktop` overrides it; the fixture's `fixture-desktop` film renders to 1920×1080.
