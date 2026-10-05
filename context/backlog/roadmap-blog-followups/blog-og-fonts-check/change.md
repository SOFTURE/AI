---
change_id: blog-og-fonts-check
title: "softure-blog check reads the OG card's brand fonts"
status: backlog
roadmap_item: BF-14
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-blog check` reads every `blog({ brand: { fonts } })` source with the OG card's loader, so a wrong
path, an unreachable URL or a file that is not a `.ttf`, `.otf` or `.woff` font fails the CI run, not the first
card in the running app.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-14**:

> ### BF-14: softure-blog check reads the OG card's fonts
> - **Change ID:** `blog-og-fonts-check`
> - **Status:** proposed
> - **Outcome:** `softure-blog check` loads `brand.fonts` through `createOgFontLoader` (from the app's root) and reports a source it cannot read with the loader's message; a check without `brand.fonts` is unchanged; a bin test covers a missing file.
> - **Risk:** low. Today the message appears when the first card renders.
> - **Mode:** autonomous.
> - **Source:** BF-8 `blog-og-fonts` impl review R1.

## Constraints

- English-only code, comments and commits (AGENTS.md).
- The loader lives in `modules/blog/src/next/og-fonts.ts`; the check is in the CLI (`src/cli/`), which must not
  import `next/og`: move the loader out of `src/next/` (it imports no Next code) or import the file directly.

## Notes
