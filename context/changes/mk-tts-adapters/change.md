---
change_id: mk-tts-adapters
title: "The voiceover is recorded through a swappable TTS provider and prices itself first"
status: impl_reviewed
roadmap_item: MK-7
branch: claude/project-thread-h3430z
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

The marketing kit records its voiceover through a `TtsProvider` interface (text, voice, model and
language in; audio plus word timings out) instead of calling ElevenLabs inline from the CLI. ElevenLabs
is one adapter behind it (key from `ELEVENLABS_API_KEY`); a fake provider drives every test, so CI
never touches the network. Before any paid call, and on every dry run, the CLI prints the cost estimate;
only `--commit` spends money. A project that already holds FIRE_TRACKER's paid recordings reuses them
without a new paid call, following a documented migration.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-7).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-7** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:**
>   - A `TtsProvider` interface (text in; audio plus word timings out) and an ElevenLabs adapter (key from `ELEVENLABS_API_KEY`).
>   - The cache key covers text, voice, model and language. FIRE's key had the language hard-coded; existing caches stay readable through a documented migration.
>   - Paid calls run only with `--commit`, and the cost estimate is printed before any call.
> - **Unknowns:**
>   - Whether the FIRE cache files can be re-keyed without new paid calls.
>   - A second provider worth stubbing for tests (a fake provider is mandatory).
> - **Baseline:** FIRE voiceover tests. After: the same tests run through the interface with a fake provider; no network in CI.

Current state (after MK-2, PR #35): `src/voice/voiceover.ts` holds the key, the ElevenLabs request and
the response parser as free functions; `src/cli/voice.ts` calls `fetch` itself, reads the key and writes
the cache. `voiceoverKey(text, voice, model, language)` already takes the language from `voice.language`
and a test pins FIRE's key for `pl` (`619a27159288f1e1`). `voice.provider` in the schema is
`"elevenlabs"` only.

## Constraints

- Exclusively owns `tools/marketing-kit/src/voice/`; touches `src/cli/voice.ts` (the voice command's
  wiring) and `src/index.ts` exports. Must not touch `src/record/` (MK-3), `src/screenshot/` (MK-4),
  `src/og/` (MK-5), `src/compose/` and `src/render/` (MK-6).
- The cache key must stay byte-compatible with FIRE's for `pl` (the pinned test).
- Paid TTS calls only with `--commit`; tests use a fake provider and a fake `fetch`, never the network.
- English-only code, comments and commits. No release, tag or publish.
- Owner rules (2026-10-03): the full SOFTURE process; master is the source of truth and conflicts are
  resolved without asking; gaps go to the followups roadmap, not fixed here.

## Notes

- Runs in parallel with MK-3, MK-4, MK-6 after MK-2.
- Research: done (light; the code is small and already ported). Framing: skipped, because the outcome
  and scope are fixed by the roadmap item, nothing is bug-shaped, and the one design fork (where the
  cost estimate lives) is settled in the plan.
