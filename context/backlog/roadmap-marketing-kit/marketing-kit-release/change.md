---
change_id: marketing-kit-release
title: "marketing-kit release"
status: backlog
roadmap_item: MK-8
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
- The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
- An example `marketing.json` and brand ship in `examples/`.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MK-8** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-8: marketing-kit release
> - **Change ID:** `marketing-kit-release`
> - **Status:** ready
> - **Outcome:**
>   - `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
>   - The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
>   - An example `marketing.json` and brand ship in `examples/`.
> - **Prerequisites:** MK-3, MK-4, MK-5, MK-6, MK-7.
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** package absent from npm. After: `npx @softure-ai/marketing-kit --help` works from npm and from the GitHub Release tarball.
> - **PRD refs:** FR-24, FR-25, FR-2.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/package.json` version, `README.md`, `examples/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- The owner approves the first (staged) publish and configures the trusted publisher.

## Notes
