---
change_id: mk-declarative-actions
title: "Declarative scene actions"
status: backlog
roadmap_item: MK-3
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- Beats carry an `actions` list (`wide`, `tap`, `type`, `fill`, `blur`, `focus`, `bring`, `mark`, `still`, `cue`, `hold`, `until`, `checkScreen`). The list maps 1:1 to Director methods.
- Targets use locator descriptors: `{role,name}`, `{text,exact,nth}`, `{label}`, `{testId}`, `{css}`, or an array meaning a union.
- `sceneModule` remains as a TS escape hatch.
- The FIRE example film expressed in JSON records the same log (beats, taps, marks) as its TS version.

## Context

From [`roadmap-marketing-kit.md`](../../../foundation/roadmaps/roadmap-marketing-kit.md), item **MK-3** (queued roadmap `marketing-kit`):

> ### MK-3: Declarative scene actions
> - **Change ID:** `mk-declarative-actions`
> - **Status:** ready
> - **Outcome:**
>   - Beats carry an `actions` list (`wide`, `tap`, `type`, `fill`, `blur`, `focus`, `bring`, `mark`, `still`, `cue`, `hold`, `until`, `checkScreen`). The list maps 1:1 to Director methods.
>   - Targets use locator descriptors: `{role,name}`, `{text,exact,nth}`, `{label}`, `{testId}`, `{css}`, or an array meaning a union.
>   - `sceneModule` remains as a TS escape hatch.
>   - The FIRE example film expressed in JSON records the same log (beats, taps, marks) as its TS version.
> - **Prerequisites:** MK-2.
> - **Unknowns:** whether conditional waits in FIRE's film need anything beyond `until(word)`; how to report a failing locator with its JSON path.
> - **Risk:** medium.
> - **Baseline:** FIRE film recording log (`RecordingLog`). After: the JSON version produces an equivalent log (same beats, marks and stills; frame counts within tolerance).
> - **PRD refs:** FR-24.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/record/` (actions, Director); not `src/compose/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
