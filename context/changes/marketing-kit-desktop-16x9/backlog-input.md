---
change_id: marketing-kit-desktop-16x9
title: "A 16:9 film can show the desktop app in a browser frame"
status: backlog
roadmap_item: FU-15
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project whose product lives on the desktop shows it as it is used, in a 16:9 film.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-15** (roadmap `followups`, main since 2026-10-03):

> ### FU-15: A 16:9 film can show the desktop app in a browser frame
> - **Change ID:** `marketing-kit-desktop-16x9`
> - **Status:** proposed
> - **Outcome:** A video can ask for a desktop recording: the recorder opens a desktop viewport (`isMobile: false`), and the 16:9 composition frames it as a browser window instead of a phone, with the same captions, persona and end card.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether the scene of a phone film can be reused at a desktop viewport or needs its own scene; how camera focus scales map to a wider screen.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-6 `mk-formats`: 16:9 is a framed phone on the left with copy on the right (frame.md, framing 2 deferred). After: a 16:9 desktop film renders from the fixture project.
> - **PRD refs:** FR-24.
> - **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

## Constraints

- Exclusively owns: the recorder's desktop mode in `tools/marketing-kit/src/record/` and a browser-frame layout in `src/compose/`.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes
