---
change_id: marketing-kit-release
title: "marketing-kit release"
status: archived
roadmap_item: MK-8
branch: null
created: 2026-10-02
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

- `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
- The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
- An example `marketing.json` and brand ship in `examples/`.

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **MK-8** (carried over on 2026-10-03 from roadmap `marketing-kit`,
archived in [`2026-10-03-4-roadmap.md`](../../foundation/archive/2026-10-03-4-roadmap.md), to roadmap `followups`,
archived in [`2026-10-04-roadmap.md`](../../foundation/archive/2026-10-04-roadmap.md), and on to the queued roadmap `later`):

> ### MK-8: marketing-kit release
> - **Change ID:** `marketing-kit-release`
> - **Status:** blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05)
> - **Outcome:**
>   - `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
>   - The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
>   - An example `marketing.json` and brand ship in `examples/`.
> - **Prerequisites:** MK-1…MK-7 (done).
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** package absent from npm. After: `npx @softure-ai/marketing-kit --help` works from npm and from the GitHub Release tarball.
> - **PRD refs:** FR-24, FR-25, FR-2.

Reference material: [`docs/03-marketing-kit.md`](../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/package.json` version, `README.md`, `examples/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- The owner approves the first (staged) publish and configures the trusted publisher.

## Notes

## Outcome (2026-10-06)

Released through the pipeline without a code change of its own: the batch release went out at 0.1.2 (staged),
0.1.4 (staged, through the trusted publishers) and 0.1.5, the first version published directly and live on npm at
once (`release-0-1-5`, checked in the registry). The owner's npm steps (trusted publishers) are done; staged
versions left over from 0.1.2 and 0.1.4 need no approval. Archived without a plan: the work was the owner's release.
