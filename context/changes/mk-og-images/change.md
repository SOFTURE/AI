---
change_id: mk-og-images
title: "OG images rendered from templates and data outside Next"
status: in_progress
roadmap_item: MK-5
branch: claude/project-thread-of0rsf
created: 2026-10-02
updated: 2026-10-03
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
- Touches shared wiring only where the command needs it: `src/config/schema.ts` (the `ogImages`
  contract, extended in place) with the regenerated `schema/marketing.schema.json`, `src/cli/main.ts`,
  `src/cli/options.ts`, `src/index.ts`, `package.json`, `README.md`. Must not touch `src/record/` (MK-3),
  `src/screenshot/` (MK-4), `src/compose/` and `src/render/` (MK-6).
- Owner rules (2026-10-03): the full SOFTURE process; master is the source of truth and conflicts are
  resolved without asking; gaps go to the followups roadmap, not fixed here.

## Notes

- Runs in parallel with MK-3, MK-4 and MK-6 after MK-2 and MK-7.
- Research: done (light). FIRE_TRACKER is not reachable from this session (clone refused), so FIRE's
  card layouts and tests are reconstructed from `docs/03-marketing-kit.md` and the roadmap baseline.
- Framing: skipped. The outcome, owner directory and contract are fixed by the roadmap item and MK-2;
  nothing is bug-shaped; the design forks (template set, font rules, snapshot form) are settled in
  the plan.
