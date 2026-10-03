---
change_id: mk-config-contract
title: "Config contract: marketing.json and brand"
status: backlog
roadmap_item: MK-2
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

a zod schema for `marketing.json` (brand, app, voice, videos, social, screenshots, ogImages, output), published as `schema/marketing.schema.json`. Every FIRE hard-coded constant (about 20) becomes config:
- default URL, port and start command;
- hidden selectors;
- locale and timezone;
- TTS language and default voice;
- fonts and logo;
- caption colours;
- platforms and the channel link template;
- geometry.

The brand can come inline or from an Impeccable `design.json`. Validation errors name the JSON path. Messages are in English.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MK-2** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-2: Config contract: marketing.json and brand
> - **Change ID:** `mk-config-contract`
> - **Status:** ready
> - **Outcome:** a zod schema for `marketing.json` (brand, app, voice, videos, social, screenshots, ogImages, output), published as `schema/marketing.schema.json`. Every FIRE hard-coded constant (about 20) becomes config:
>   - default URL, port and start command;
>   - hidden selectors;
>   - locale and timezone;
>   - TTS language and default voice;
>   - fonts and logo;
>   - caption colours;
>   - platforms and the channel link template;
>   - geometry.
>
>   The brand can come inline or from an Impeccable `design.json`. Validation errors name the JSON path. Messages are in English.
> - **Prerequisites:** MK-1.
> - **Unknowns:**
>   - Which `design.json` roles map to the brand colour roles.
>   - Whether FIRE's TS film modules convert to JSON losslessly apart from scenes (scenes are MK-3).
> - **Risk:** medium. This is the contract every later item builds on.
> - **Baseline:** constants grep in MK-1 output. After: zero product-specific literals in `src/` (architecture test), and the example config validates.
> - **PRD refs:** FR-24, NFR-6.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/config/`, `tools/marketing-kit/schema/`; the constants it replaces across `src/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
