---
change_id: fire-adopt-marketing-kit
title: "FIRE_TRACKER adopts marketing-kit"
status: backlog
roadmap_item: MK-9
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

FIRE_TRACKER follows the adoption playbook (docs/05):
- it deletes `video/src/**`, `scripts/screenshot.mts` and the OG generation code;
- it keeps `marketing.json`, the brand files and its committed voiceover cache;
- it renders its current film with `@softure-ai/marketing-kit`. The output has the same scenes, beat timing, captions and end card as before.

Paid TTS is not re-run, and the cache is reused.

## Context

From [`roadmap-marketing-kit.md`](../../../foundation/roadmaps/roadmap-marketing-kit.md), item **MK-9** (queued roadmap `marketing-kit`):

> ### MK-9: FIRE_TRACKER adopts marketing-kit
> - **Change ID:** `fire-adopt-marketing-kit`
> - **Status:** ready
> - **Outcome:** FIRE_TRACKER follows the adoption playbook (docs/05):
>   - it deletes `video/src/**`, `scripts/screenshot.mts` and the OG generation code;
>   - it keeps `marketing.json`, the brand files and its committed voiceover cache;
>   - it renders its current film with `@softure-ai/marketing-kit`. The output has the same scenes, beat timing, captions and end card as before.
>
>   Paid TTS is not re-run, and the cache is reused.
> - **Prerequisites:** MK-8.
> - **Unknowns:** whether FIRE's channel-tag reader is fully replaced by the link template in config; how its OG routes become thin wrappers.
> - **Risk:** medium. This is the real-world verification.
> - **Baseline:** the current FIRE film (scene list, beat timestamps, duration). After: matches within one frame per beat; FIRE CI green.
> - **PRD refs:** FR-26, G-2.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: nothing in this repository; the change runs in FIRE_TRACKER (`video/`, `scripts/screenshot.mts`, OG routes).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- Follows `docs/05-adoption-playbook.md`. Paid TTS is not re-run: the committed voiceover cache is reused. Product domain in examples is `example.com`.

## Notes
