---
change_id: mk-screenshots
title: "softure-marketing shots renders the configured screenshots behind quality gates"
status: archived
roadmap_item: MK-4
branch: claude/project-thread-p5jnbq
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

`softure-marketing shots [<id>]` renders the `screenshots` entries of a project's `marketing.json`
(one entry or all of them) into `<output.dir>/screenshots/<id>.png`. Each entry sets its viewport
(`width`, `height`), a full-page capture that first scrolls the page so lazy content loads, and the
reduced-motion preference. Every screenshot passes FIRE's gates or is refused:

- the page answers with an HTTP status below 400;
- the page shows the expected phrase;
- the file is at least `minBytes` (40 kB by default); a smaller file is deleted.

Flags and messages are in English. Tests cover the gates against a static fixture page.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-4).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-4** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** `softure-marketing shots` renders the `screenshots` entries of `marketing.json`.
>   Options cover width, height, full page with a lazy-load scroll, and motion reduce/no-preference.
>   It applies the FIRE gates: HTTP status below 400; the expected phrase is present; the file is at
>   least 40 kB, and smaller output is deleted. Flags and messages are in English.
> - **Unknowns:** whether a shared app-start helper with the recorder (`app.startCommand`) is enough
>   for both.
> - **Baseline:** FIRE screenshot script behaviour. After: the same gates, covered by tests against a
>   static fixture page.

Current state (MK-2, PR #35): the `screenshots[]` section of `marketing.json` exists as a contract
only (`src/config/schema.ts`, `screenshotSchema`); no command reads it.

## Constraints

- Exclusively owns `tools/marketing-kit/src/screenshot/`. The CLI wiring (`src/cli/`) and the
  fixture/README get the smallest change that exposes the command.
- Runs in parallel with MK-3 (`src/record/`), MK-6 (`src/compose/`, `src/render/`) and MK-7
  (`src/voice/`); none of their folders is touched. MK-5 (OG images) is not part of this item.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish.
- Owner rules (2026-10-03): the full SOFTURE process; master is the source of truth and conflicts are
  resolved without asking; gaps go to the followups roadmap, not fixed here.

## Notes

- Research: done ([`research.md`](research.md)). Framing: done ([`frame.md`](frame.md)), short,
  because the outcome is fixed by the roadmap and the open choice is only how much of the CLI changes.
- Archived 2026-10-03: `softure-marketing shots` renders the `screenshots` entries behind the status, phrase and size gates, tested against static pages and the fixture app in CI (PR #38). Review F1-F2 fixed before the PR; device scale and light/dark pairs deferred to FU-17.
