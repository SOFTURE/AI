# Frame: mk-config-contract

## Request as stated

Roadmap MK-2: a zod schema for `marketing.json` (brand, app, voice, videos, social, screenshots,
ogImages, output) published as JSON Schema; every FIRE constant becomes config; brand inline or from an
Impeccable `design.json`; validation errors name the JSON path.

## Observation, premise, direction

- Observation: 18 product-specific literals sit in `src/` (research, inventory); a second product
  cannot make a film without editing the package.
- Premise: one declarative file (plus a brand) is what projects and agents need; scenes stay code for now.
- Proposed direction: the full contract now, every later item (MK-3…MK-7) consumes its section.

## Premise check

- Do nothing for 3 months: MK-3…MK-7 cannot start (they all depend on MK-2), and FIRE cannot adopt
  the package without its own constants in our source.
- Evidence: the inventory is concrete (`record.ts:96-114`, `compose.ts:37-321`, `voiceover.ts:16-22`,
  `posts.ts:12-25`, `timeline.ts:11-17`).
- Already solved elsewhere: the design.json shape (`foundation/ui/src/theme/design-json.ts`), the channel
  rule (`modules/analytics/src/options.ts:7`). Both reused as rules, neither as a dependency (research).
- Smallest proof: the fixture project renders from `marketing.json` with no FIRE literal left in `src/`.

## Framings

| Option | What we build | Cost vs as-asked | Risk |
| --- | --- | --- | --- |
| A. Constants only | keep `marketing.config.json` and TS films, add keys for the 18 literals | about half | MK-3 has no `beats` in JSON to attach actions to; the contract is rewritten again |
| B. As asked, behaviour only where it exists | full `marketing.json` schema; video data moves into `videos[]`, the scene stays a TS `sceneModule`; `screenshots` and `ogImages` are schema only (MK-4, MK-5 build them); the frame stays 9:16 with the device from config (MK-6 adds formats) | as asked | the geometry refactor touches compose and record |
| C. Everything at once | B plus formats, actions and the TTS interface | about triple | collides with four items that own those folders |

## Decision

B, because MK-3, MK-4, MK-5 and MK-7 each need their section of the contract to exist, and every
behaviour beyond the literals already has an owner item. Confidence: HIGH.
Problem to plan around: one validated `marketing.json` drives the existing pipeline with no FIRE
literal in `src/`. Scope now: the schema and JSON Schema, brand resolution (inline, CSS, design.json),
the 18 literals, film data in `videos[]`, the fixture. Out of scope now: actions (MK-3), the provider
interface and cache migration (MK-7), formats other than 9:16 (MK-6), the `shots` and `og` commands
(MK-4, MK-5).
What changes for the plan: the `screenshots` and `ogImages` schemas are drafted from the roadmap
outcomes of MK-4 and MK-5 so those items extend rather than redesign them.
