---
change_id: mk-declarative-actions
title: "A film's scene is written as JSON actions in marketing.json"
status: planned
roadmap_item: MK-3
branch: claude/project-thread-vfwcqk
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project describes what happens on screen, sentence by sentence, as an `actions` list on each beat of
`marketing.json`, instead of writing a TypeScript scene module. Each action maps 1:1 to a Director
method (`wide`, `tap`, `type`, `fill`, `blur`, `focus`, `bring`, `mark`, `still`, `cue`, `hold`,
`until`, `checkScreen`), and targets are locator descriptors (`{role,name}`, `{text,exact,nth}`,
`{label}`, `{testId}`, `{css}`, or an array meaning a union). A failing locator names its JSON path.
`sceneModule` stays as the TypeScript escape hatch. FIRE's film, written in JSON, drives the Director
exactly as its TS scene does.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-3).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-3** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** beats carry an `actions` list mapping 1:1 to Director methods; targets use locator
>   descriptors; `sceneModule` remains as a TS escape hatch; the FIRE example film expressed in JSON
>   records the same log (beats, taps, marks) as its TS version.
> - **Unknowns:** whether conditional waits in FIRE's film need anything beyond `until(word)`; how to
>   report a failing locator with its JSON path.
> - **Baseline:** FIRE film recording log (`RecordingLog`). After: the JSON version produces an
>   equivalent log (same beats, marks and stills; frame counts within tolerance).

Current state (MK-2, PR #35, `archive/2026-10-03-mk-config-contract/`): `videos[].sceneModule` names a
TS module exporting `scene(director)`, loaded with `tsImport` (`src/cli/films.ts`); the Director lives in
`src/record/record.ts`.

Handoff notes from MK-2 (coordinator brief, 2026-10-03):
1. Every schema change regenerates `schema/marketing.schema.json` (`npm run schema -w @softure-ai/marketing-kit`);
   `tests/schema.test.ts` catches drift. Cross-field rules live in `superRefine` with explicit paths.
2. `sceneModule` stays; `actions` is added to the beat schema next to it.
3. `tests/architecture.test.ts` forbids FIRE literals in `src/`.
4. The render test is opt-in (`MARKETING_KIT_RENDER=1`, about 80 s); run it when record changes.
5. No lazy `[\s\S]*?` regexes over CSS (CodeQL).

## Constraints

- Exclusively owns `tools/marketing-kit/src/record/` (actions, Director). Shared files touched only where
  the contract needs it: `src/config/schema.ts`, `src/config/config.ts`, `src/film.ts`, `src/cli/films.ts`,
  `schema/marketing.schema.json`, the fixture. MK-4 (`src/screenshot/`), MK-6 (`src/compose/`,
  `src/render/` geometry) and MK-7 (`src/voice/`) run in parallel; their folders are not touched.
- English-only code, comments and commits (AGENTS.md); user-facing copy only in `messages/{pl,en}.ts`.
- FIRE_TRACKER is read-only (cloned for reading). No release, tag or publish (the owner tags releases).
- Owner rules (2026-10-03): the full SOFTURE process; master is the source of truth and conflicts are
  resolved without asking; gaps go to the followups roadmap, not fixed here.

## Notes

- Runs in parallel with MK-4, MK-6, MK-7 (roadmap order step 3).
- Research: done (FIRE's scene inventory: which Playwright locator calls and options it uses).
  Framing: done (option B, JSON actions with a strict descriptor and static checks at load time).
