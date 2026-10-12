---
change_id: og-font-loader-414
title: "seo + blog: the OG font loader outside the blog (issue #414)"
status: archived
roadmap_item: null
issue: 414
branch: claude/project-thread-hk3fe6
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #414](https://github.com/SOFTURE/AI/issues/414) (labels `enhancement`, `adoption`, `pkg: blog`,
`pkg: seo`): `createOgFontLoader` / `loadBrandOgFonts` (font signature check, cache) are exported only from
`@softure-ai/blog/server` and `/next`, so an app that renders OG cards outside the blog keeps its own copy.

Outcome: an app imports the loader from `@softure-ai/seo/server` without installing the blog; the blog keeps its
exports (`createOgFontLoader`, `loadBrandOgFonts`, `OgFont`, `OgFontLoaderOptions`, `OgFontsResult`) and its error
messages unchanged.

A reviewer checks the loader's tests in its new home, the seo re-export test, the blog's unchanged OG tests, the READMEs
and the CHANGELOG `Unreleased` entries.

## Context

seo is at 0.1.8, blog at 0.1.11, core at 0.1.9 on master. Releases are batched by the coordinator, so this change bumps
no version: each touched package's CHANGELOG gets an `## Unreleased` entry.

## Constraints

- `@softure-ai/seo` stays an optional peer of the blog (decided in `context/archive/2026-10-05-blog-seo-canonical/`):
  an app with the blog and without seo still runs and builds. So the blog cannot import the loader from seo.
- The blog's public names and its messages (`Blog OG card: brand.fonts[i] ...`, read by `softure-blog check`) stay.
- No `next/*` import in the loader: `softure-blog check` runs it outside Next.

## Process notes

- Framing: skipped. The issue names the problem and the ask.

## Decisions (auto)

- The implementation moves to a new server-only entry `@softure-ai/core/og` (core is a dependency of both seo and
  blog), `@softure-ai/seo/server` re-exports it as the documented home for apps, and the blog re-exports it from
  `/server` and `/next`. Moving it into seo itself would make seo a required peer of the blog, against the constraint
  above.
- The loader's message prefix becomes an option (`label`, default `OG card: fonts`); the blog passes
  `Blog OG card: brand.fonts`, so its messages do not change.
- `loadOgFonts(fonts)` (sources from the working directory, one cache per process) joins `createOgFontLoader` for an
  app's own `opengraph-image` routes; the blog's `loadBrandOgFonts` keeps its name and label.
- No version bump; `## Unreleased` in the core, seo and blog CHANGELOGs.

## Before the next release

- Release core first; then raise the `@softure-ai/core` range of seo and blog to the new core version (both import
  `@softure-ai/core/og`), and release seo and blog with it.
