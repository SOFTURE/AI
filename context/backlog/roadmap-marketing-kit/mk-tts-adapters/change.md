---
change_id: mk-tts-adapters
title: "TTS provider adapters"
status: backlog
roadmap_item: MK-7
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- A `TtsProvider` interface (text in; audio plus word timings out) and an ElevenLabs adapter (key from `ELEVENLABS_API_KEY`).
- The cache key covers text, voice, model and language. FIRE's key had the language hard-coded; existing caches stay readable through a documented migration.
- Paid calls run only with `--commit`, and the cost estimate is printed before any call.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MK-7** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-7: TTS provider adapters
> - **Change ID:** `mk-tts-adapters`
> - **Status:** ready
> - **Outcome:**
>   - A `TtsProvider` interface (text in; audio plus word timings out) and an ElevenLabs adapter (key from `ELEVENLABS_API_KEY`).
>   - The cache key covers text, voice, model and language. FIRE's key had the language hard-coded; existing caches stay readable through a documented migration.
>   - Paid calls run only with `--commit`, and the cost estimate is printed before any call.
> - **Prerequisites:** MK-2.
> - **Unknowns:**
>   - Whether the FIRE cache files can be re-keyed without new paid calls.
>   - A second provider worth stubbing for tests (a fake provider is mandatory).
> - **Risk:** low.
> - **Baseline:** FIRE voiceover tests. After: the same tests run through the interface with a fake provider; no network in CI.
> - **PRD refs:** FR-24.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/voice/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- Paid TTS calls only with `--commit`; CI never calls a paid API.

## Notes
