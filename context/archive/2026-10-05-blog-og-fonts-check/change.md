---
change_id: blog-og-fonts-check
title: "softure-blog check reads the OG card's brand fonts"
status: archived
roadmap_item: BF-14
branch: claude/project-thread-l5x1qg
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`softure-blog check` reads every `blog({ brand: { fonts } })` source with the OG card's loader, so a wrong
path, an unreachable URL or a file that is not a `.ttf`, `.otf` or `.woff` font fails the CI run, not the
first card in the running app. A reviewer checks that the bin's `check` over a config whose `brand.fonts`
names a missing file exits 1 with the loader's message (`brand.fonts[i]`, the source and the resolved
path), that a readable font adds nothing to the output, and that a config without `brand.fonts` checks as
before.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-14, taken 2026-10-05).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-14**:

> - **Outcome:** `softure-blog check` loads `brand.fonts` through `createOgFontLoader` (from the app's root) and reports a source it cannot read with the loader's message; a check without `brand.fonts` is unchanged; a bin test covers a missing file.
> - **Risk:** low. Today the message appears when the first card renders.
> - **Source:** BF-8 `blog-og-fonts` impl review R1.

BF-8 (PR #95) is on `master`: `createOgFontLoader` in `modules/blog/src/next/og-fonts.ts` reads a path
(from a root) or an https URL, checks the font signature and returns `{ ok: false, error }` naming
`brand.fonts[i]`. BF-6 and BF-13 are on `master`: the bin runs `check` without a database URL.

Coordinator brief (2026-10-05): only BF-14, lane D (it also touches `src/cli/`, lane A is idle); BF-12
runs in parallel; gaps go to the roadmap from the next free `BF-` number on `master`.

## Constraints

- Owns: `modules/blog/src/next/og-fonts.ts`, `modules/blog/src/next/og-image.tsx` (the `OgFont` type
  only), a new `modules/blog/src/server/og-fonts.ts`, `modules/blog/src/cli/run.ts` (`runCheck`),
  the blog tests for the check and the architecture, the blog README's check and font paragraphs.
- The CLI must not import Next code (`next/og`): the loader moves out of `src/next/`.
- The public API of `@softure-ai/blog/next` stays as it is (`createOgFontLoader`, `loadBrandOgFonts`,
  `OgFont`, `OgFontLoaderOptions`, `OgFontsResult`).
- English-only code, comments and commits (AGENTS.md).

## Notes

- Placement: main roadmap blog-followups, item BF-14 (work now).
- Research skipped: the loader, its messages and its tests exist (BF-8); the check command's structure
  (`runCheck`, `reportCheck`) and its bin tests exist (BF-6, BF-13); nothing outside this repository is
  involved. The plan cites the files it builds on.
- Framing skipped: the problem and the outcome are fixed by the roadmap item (BF-8 impl review R1); the
  one shape question (where the loader lives so the CLI can import it) is a plan decision.
- Archived 2026-10-05: `softure-blog check` reads every `brand.fonts` source with the card's loader (now in `src/server/og-fonts.ts`) from the working directory and reports one it cannot read as an error with the loader's message; `runBlogCli({ fontFetch })`; no gaps.
