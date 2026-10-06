---
change_id: ui-color-guards
title: "Colour contrast and colour-vision guards"
status: archived
roadmap_item: CH-3
branch: claude/ch-3-contrast-5ffi4r
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`@softure-ai/ui/testing` gives apps and packages the colour guards FIRE_TRACKER grew in its own tree: the WCAG 2
contrast ratio with its pass levels, colour-vision simulation (protan, deutan, tritan) with a minimum-distance check
between colours, and `checkThemeContrast(pairs)` over the light and dark token sets. `@softure-ai/ui` runs that check
on its own default tokens, so a token change that breaks contrast fails `npm test` in CI.

A reviewer checks `foundation/ui/tests/theme-contrast.test.ts` (the default tokens pass; a darkened token is caught),
the oracle tests of the helpers, and the `./testing` export of the package.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CH-3, taken 2026-10-06).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (charts), item **CH-3**:

> - **Outcome:** Test helpers exported from `@softure-ai/ui/testing`: WCAG 2 contrast ratio and pass levels;
>   colour-vision simulation (protan, deutan, tritan) and a minimum distance check between colours;
>   `checkThemeContrast(pairs)` over the light and dark token sets; `@softure-ai/ui` runs it on its own tokens.
> - **Unknowns:** Which colour difference metric (Delta E 2000 vs. a simpler one) gives stable thresholds.
> - **Baseline:** FIRE `src/lib/color-vision.ts` and `src/app/theme-contrast.test.ts`.

CH-4 (series palette guard) builds on these helpers; FIRE_TRACKER adopts them in its own roadmap.

## Constraints

- Exclusively owns `foundation/ui/src/testing/`; also touches `foundation/ui/package.json` (export, version),
  `foundation/ui/README.md`, `foundation/ui/tests/` and the root lockfile (version).
- English-only code, comments and commits (AGENTS.md). FIRE_TRACKER is read only.
- Bumps `@softure-ai/ui` (roadmap release order); no release, tag or publish by the agent.

## Process notes

- Research: short ([`research.md`](research.md)): the source is two FIRE files, the open question is the distance
  metric, settled by a measurement.
- Framing: skipped. The roadmap names the exact helpers, the problem (token changes that silently break contrast,
  palettes that collapse under colour-vision deficiency) is measured in FIRE's history (RD-4, RD-5, P-3), and the
  only open choice (the metric) is a research question, not a framing one.
