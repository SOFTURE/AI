---
change_id: blog-seo-canonical
title: "The blog's page URLs follow the canonical rule of @softure-ai/seo"
status: backlog
roadmap_item: BF-7
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The blog's canonical, Open Graph and JSON-LD URLs are built with the canonical host and trailing-slash
rule of `@softure-ai/seo` when the app uses it, so a blog page never declares a canonical that differs
from the one the sitemap and the rest of the app use.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-7**:

> ### BF-7: Blog URLs follow the seo canonical rule
> - **Change ID:** `blog-seo-canonical`
> - **Status:** ready
> - **Outcome:** the blog's pages build canonical, OG and JSON-LD URLs through `@softure-ai/seo`'s canonical URL helper when `seo()` is in the config, and on `appOrigin` otherwise; a test covers a canonical host that differs from `appOrigin` and a trailing-slash rule.
> - **Risk:** low. The example app's canonical host equals `appOrigin`; only an app with another canonical host is affected.
> - **Source:** BL-4 `blog-pages` impl review R1 (`src/next/pages.tsx` `getAbsoluteUrl`, `src/pages/json-ld.ts`).

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Fits naturally next to BL-5 (blog sitemap entries use the same rule).

## Notes
