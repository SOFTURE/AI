---
change_id: mk-screenshots
title: "Screenshots with quality gates"
status: backlog
roadmap_item: MK-4
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`softure-marketing shots` renders the `screenshots` entries of `marketing.json`. Options cover width, height, full page with a lazy-load scroll, and motion reduce/no-preference. It applies the FIRE gates:
- HTTP status below 400;
- the expected phrase is present;
- the file is at least 40 kB, and smaller output is deleted.

Flags and messages are in English.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MK-4** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-4: Screenshots with quality gates
> - **Change ID:** `mk-screenshots`
> - **Status:** ready
> - **Outcome:** `softure-marketing shots` renders the `screenshots` entries of `marketing.json`. Options cover width, height, full page with a lazy-load scroll, and motion reduce/no-preference. It applies the FIRE gates:
>   - HTTP status below 400;
>   - the expected phrase is present;
>   - the file is at least 40 kB, and smaller output is deleted.
>
>   Flags and messages are in English.
> - **Prerequisites:** MK-2.
> - **Unknowns:** whether a shared app-start helper with the recorder (`app.startCommand`) is enough for both.
> - **Risk:** low. FIRE's `scripts/screenshot.mts` is almost package-ready.
> - **Baseline:** FIRE screenshot script behaviour. After: the same gates, covered by tests against a static fixture page.
> - **PRD refs:** FR-25.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/screenshot/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
