---
change_id: mk-og-images
title: "OG images outside Next"
status: backlog
roadmap_item: MK-5
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- `softure-marketing og` renders `ogImages` entries with Satori to PNG, at 1200×630 by default.
- Templates take `data`, for example `headline-cta` with headline, CTA and tiles.
- Fonts and palette come from the brand.
- Values computed by the app (charts) arrive precomputed in `data` (numbers or SVG paths).
- Apps can keep a thin Next route that calls the package.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-5** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-5: OG images outside Next
> - **Change ID:** `mk-og-images`
> - **Status:** ready
> - **Outcome:**
>   - `softure-marketing og` renders `ogImages` entries with Satori to PNG, at 1200×630 by default.
>   - Templates take `data`, for example `headline-cta` with headline, CTA and tiles.
>   - Fonts and palette come from the brand.
>   - Values computed by the app (charts) arrive precomputed in `data` (numbers or SVG paths).
>   - Apps can keep a thin Next route that calls the package.
> - **Prerequisites:** MK-2.
> - **Unknowns:** whether `satori` + `@resvg/resvg-js` reproduce FIRE's current cards closely enough; font loading rules (only weights that are actually loaded, as FIRE's OG tests require).
> - **Risk:** low.
> - **Baseline:** FIRE OG card tests (`og-card`, `og-palette`). After: equivalent tests on templates, and a PNG snapshot per template.
> - **PRD refs:** FR-25.

Reference material: [`docs/03-marketing-kit.md`](../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/og/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
