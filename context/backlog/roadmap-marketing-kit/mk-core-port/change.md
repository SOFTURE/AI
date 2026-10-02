---
change_id: mk-core-port
title: "Port the FIRE video core"
status: backlog
roadmap_item: MK-1
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`tools/marketing-kit` contains the FIRE_TRACKER pipeline, ported 1:1 with its tests:
- `voiceover` (cache by content hash, word timings);
- `timeline` (beats, caption chunking);
- `record` (frame-by-frame Playwright, frozen clock, Director DSL, screen guard);
- `compose` (HTML composition: phone frame, camera, captions, persona card, hook, end card);
- `render` (ffmpeg + pinned hyperframes);
- `posts`;
- a CLI `softure-marketing <all|voice|record|render|preview|posts>` with preflight (ffmpeg, hyperframes).

Config may still be FIRE-shaped. Paths resolve relative to a config file, not the repo.

## Context

From [`roadmap-marketing-kit.md`](../../../foundation/roadmaps/roadmap-marketing-kit.md), item **MK-1** (queued roadmap `marketing-kit`):

> ### MK-1: Port the FIRE video core
> - **Change ID:** `mk-core-port`
> - **Status:** ready
> - **Outcome:** `tools/marketing-kit` contains the FIRE_TRACKER pipeline, ported 1:1 with its tests:
>   - `voiceover` (cache by content hash, word timings);
>   - `timeline` (beats, caption chunking);
>   - `record` (frame-by-frame Playwright, frozen clock, Director DSL, screen guard);
>   - `compose` (HTML composition: phone frame, camera, captions, persona card, hook, end card);
>   - `render` (ffmpeg + pinned hyperframes);
>   - `posts`;
>   - a CLI `softure-marketing <all|voice|record|render|preview|posts>` with preflight (ffmpeg, hyperframes).
>
>   Config may still be FIRE-shaped. Paths resolve relative to a config file, not the repo.
> - **Prerequisites:** FD-1, FD-2 (roadmap trigger).
> - **Unknowns:**
>   - Which tests depend on the FIRE app itself (site-token parsing of `globals.css`, channel tags) and how to stub them.
>   - Whether GSAP and hyperframes can be npm dependencies with no files copied into the package (GSAP is under its own no-charge license, hyperframes is Apache-2.0).
> - **Risk:** medium. ~2.5k LOC with external binaries (ffmpeg, Chromium).
> - **Baseline:** FIRE `video/**` tests (film, timeline, voiceover, compose, posts, site tokens). After: the same tests are green in the package, and a fixture film renders a draft MP4 in CI or locally.
> - **PRD refs:** FR-24, NFR-1, NFR-2.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/` as a whole (the port moves the code in).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- License: GSAP and hyperframes (Apache-2.0, pinned version) are npm dependencies; no third-party files are copied into the package. No Pixabay SFX and no fonts are bundled.

## Notes
