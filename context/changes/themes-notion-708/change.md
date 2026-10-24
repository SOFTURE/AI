---
change_id: themes-notion-708
title: "themes: shared theme packages, starting with a Notion theme on shadcn/ui (issue #708)"
status: implementing
roadmap_item: null
issue: 708
branch: claude/project-thread-6eu3g7
created: 2026-10-24
updated: 2026-10-24
---

## Intent

Close [issue #708](https://github.com/SOFTURE/AI/issues/708): apps that adopt the Notion-style design system stop
copying its theme and components. A new workspace group `themes/` holds a shared kit (`@softure-ai/theme-kit`) and
one package per theme; the first is `@softure-ai/theme-notion`. An app installs the theme package, imports its CSS
and components, and writes no theme code of its own.

## Context

- Source of the look: the owner's Notion design system (shadcn/ui new-york v4, Radix, Tailwind CSS v4, lucide icons;
  tokens, 36 tuned components, three compositions).
- One adopting app already implements it (theme CSS checked against a token snapshot, 27 components with fixes over
  the design system's files, compositions, the `--sft-*` bridge for package pages, a scoped preflight). It is the
  reference implementation; it migrates to the packages in a change of its own.
- More themes follow (a second app's own look), so the kit is theme-agnostic and the theme packages share it.

## Constraints

- No release: the first publish of a new package needs the owner's `NPM_TOKEN` step
  (scripts/release/README.md, "First release of a new package").
- Reusable code only; nothing specific to one app (its meaning tables, its screens, its copy).
- Package shape rules of `tests/repo/packages.test.ts` hold for both packages.

## Notes

- Framing: skipped. The owner named the outcome and the reference implementation.
