---
change_id: mk-config-contract
title: "A project describes its films and brand in one validated marketing.json"
status: plan_reviewed
roadmap_item: MK-2
branch: claude/project-thread-xaujo8
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project that adopts `@softure-ai/marketing-kit` describes everything product-specific in one
`marketing.json` (brand, app, voice, videos, social, screenshots, ogImages, output), checked by a zod
schema that is also published as `schema/marketing.schema.json`. The brand's colours come inline, from
the app's stylesheet or from an Impeccable `design.json`. A broken config is refused with the JSON path
of every problem, in English. No FIRE_TRACKER constant is left in `tools/marketing-kit/src/` (an
architecture test checks it), and the fixture project renders from its `marketing.json`.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-2).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-2** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** a zod schema for `marketing.json` (brand, app, voice, videos, social, screenshots,
>   ogImages, output), published as `schema/marketing.schema.json`. Every FIRE hard-coded constant
>   (about 20) becomes config: default URL, port and start command; hidden selectors; locale and
>   timezone; TTS language and default voice; fonts and logo; caption colours; platforms and the
>   channel link template; geometry. The brand can come inline or from an Impeccable `design.json`.
>   Validation errors name the JSON path. Messages are in English.
> - **Unknowns:** Which `design.json` roles map to the brand colour roles. Whether FIRE's TS film
>   modules convert to JSON losslessly apart from scenes (scenes are MK-3).
> - **Baseline:** constants grep in MK-1 output. After: zero product-specific literals in `src/`
>   (architecture test), and the example config validates.

Current state (MK-1, PR #34, `archive/2026-10-03-mk-core-port/`): `marketing.config.json` is
FIRE-shaped (`src/config/config.ts`); a film is a TS module with data and scene together
(`src/film.ts`); the MK-1 handoff lists the constants still in code (README "Limitations").

Handoff notes from MK-1 (coordinator brief, 2026-10-03):
1. Hard-coded FIRE constants: phone 390×844 @3 and the 9:16 frame; `pl-PL` and `Europe/Warsaw` in the
   recording browser; hidden selectors (`nextjs-portal`, a FIRE test id); the screen guard reading
   `main`; the end card's logo and caption colours; font file names and the three platforms.
2. `marketing.config.json` is replaced by the `marketing.json` + brand contract.
3. `isChannelCode` duplicates the channel rule of the analytics module; align it with the contract.
4. The voiceover language `"pl"` is part of the cache key (a test pins `619a27159288f1e1`); the
   configurable language belongs to MK-7, and the key must stay compatible.
5. The ported core throws; moving validation to result values fits the contract work.
6. The render test is opt-in (`MARKETING_KIT_RENDER=1`), not in CI (FU-13).
7. No lazy `[\s\S]*?` regexes over CSS (CodeQL).

## Constraints

- Exclusively owns `tools/marketing-kit/src/config/` and `tools/marketing-kit/schema/`, plus the
  constants it replaces across `src/` (this item runs alone; MK-3…MK-8 wait for it).
- Leaves to later items: declarative scene actions (MK-3, `src/record/` actions), the `TtsProvider`
  interface and cache migration (MK-7, `src/voice/`), the 1:1 and 16:9 formats (MK-6), the `shots`
  and `og` commands (MK-4, MK-5), the release (MK-8). Their config sections are defined here as the
  contract; their behaviour is not built.
- English-only code, comments and commits (AGENTS.md); user-facing copy only in `messages/{pl,en}.ts`.
- FIRE_TRACKER is read-only. No release, tag or publish (the owner tags releases).
- Owner rules (2026-10-03): the full SOFTURE process; master is the source of truth and conflicts are
  resolved without asking; gaps go to the followups roadmap, not fixed here.

## Notes

- Runs alone after MK-1 (roadmap order step 2).
