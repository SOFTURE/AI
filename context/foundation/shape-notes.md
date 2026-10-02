---
project: "SOFTURE AI"
session: 1
created: 2026-10-02
updated: 2026-10-02
status: accepted
---

# Shape notes: tested building blocks that AI agents assemble instead of rewriting

Source: the owner's shaping session on 2026-10-02 (decisions recorded below), the module
assessment in `docs/01-module-assessment.md` and the FIRE_TRACKER codebase (`../../FIRE_TRACKER`, a sibling of the SOFTURE folder; local only).

## Current system

- SOFTURE is an open-source org with .NET libraries on NuGet (COMMON, API, FAKTUROWNIA, …),
  one GitHub repository per family, released on tags.
- `@softure-ai/skills` (repo SOFTURE/SKILLS) is published: the agent delivery workflow that will
  build and consume these modules.
- This repository holds the plan only: docs 01–05, README skeletons for `foundation/`, `modules/`,
  `tools/marketing-kit/`. There is no code, no build, no CI yet.
- FIRE_TRACKER (Next 16, React 19, Drizzle + Postgres/PGlite, Tailwind 4) already implements most
  generic capabilities by hand, in a consistent three-layer style. It is the extraction source and
  the first consumer.

## Problem

Every new AI-built app re-implements the same infrastructure: auth, sessions, roles, feature
switches, mail with unsubscribe, waitlists, MCP access tokens, billing/trial, GDPR export and
deletion, channel analytics, UI primitives, marketing videos. Agents write it from scratch each
time. That is slow, and every copy has its own bugs. Example: the hand-written switches panel in
the source app had no admin check. Owner's words: "AI should rely on ready, well-tested packages
instead of creating everything from scratch, because that takes much more time than wiring
ready packages together."

## Who it is for

- **Primary:** the owner's AI agents building new apps (FIRE_TRACKER first, then the next apps),
  via the `softure-*` skills.
- **Secondary:** open-source users of React/Next.js/Postgres who want drop-in vertical slices.
- **Not for:** apps that cannot run Postgres, or teams that need a hosted BaaS (Supabase/Clerk-style
  services). This is a library set, not a service.

## Today

Copy-paste between repos, or the agent re-derives everything from prompts. Hosted auth or mail
SaaS is possible, but it costs money per app and does not cover UI, migrations or GDPR together.

## Why now

AI agents now produce most of the code. Shared, tested blocks multiply that speed, and
FIRE_TRACKER has just stabilised the patterns worth extracting.

## Appetite

Owner-driven and incremental. Each wave must leave FIRE_TRACKER running on the released modules
before the next wave starts. Scope flexes per wave; the standard does not.

## Solution sketch

- npm monorepo `@softure-ai/*` (public, MIT), one GitHub repo (SOFTURE/AI), tag-driven releases to
  npm and GitHub, the same as SOFTURE/SKILLS.
- Foundations: `core` (module contract, config, results, clock, i18n), `db` (client, per-module
  Postgres schemas, migrator with adoption), `ui` (`--sft-*` tokens, compiled CSS, primitives).
- Vertical-slice modules, each with migrations, server logic, a Next adapter, styled UI and pl + en
  messages: security, auth, feature-switches, ops, mailing, waitlist, mcp-access, privacy, billing,
  analytics.
- `@softure-ai/marketing-kit`: a CLI that renders videos, screenshots and OG images from
  `marketing.json` plus brand.
- An app opts in through one `softure.config.ts`. Presence in `modules` switches a module on, and
  runtime switches come from `feature-switches`.
- Verification loop: after each module ships, FIRE_TRACKER deletes its own code and adopts the
  module. Green FIRE CI marks the version as verified.

## Rabbit holes

- **Server actions shipped from `node_modules`** (Next encryption, `allowedOrigins`, bundling).
  Decision: spike first, inside the identity roadmap, before the auth module is built.
- **Migration adoption on live data** (moving `users` into `auth.users`). Decision: an `--adopt`
  mode with schema comparison and a dry run on a production copy before every FIRE adoption.
- **Styling flexibility vs. consistency.** Decision: three levels (tokens, `classNames` slots,
  `unstyled`) and compiled CSS in `@layer softure`.
- **Third-party assets in marketing-kit** (Pixabay SFX, GSAP, fonts). Decision: GSAP as an npm
  dependency; no bundled SFX or fonts.

## No-gos

- No hosted service and no vendor lock-in. Providers (mail, payments, TTS) stay behind adapters.
- No Polish (or any non-English) in code, comments, identifiers or commits. Product copy lives
  only in message dictionaries.
- No module that the source app has not proven, unless it fills a gap found during extraction
  (password reset by token, roles, consent records).
- No releases or deploys by agents. The owner tags releases.

## Success signals

| Signal | Threshold | How measured |
|---|---|---|
| FIRE_TRACKER runs on released modules | all wave-1 modules adopted, FIRE CI green | FIRE CI + `softure doctor` |
| Code removed from FIRE per adopted module | its implementation deleted, only config and copy remain | diff stat of each adoption change |
| New app bootstrap | auth + switches + mail working in a fresh Next app in under 1 hour of agent time | example app timing |
| Quality | every module: unit (PGlite) + e2e in the example app; no release with a red gate | CI |

## Open questions

- Payment provider after the manual adapter (Stripe vs. Przelewy24): owner, before the
  monetization roadmap starts.
- Which second app adopts the modules after FIRE: owner, at the end of the identity roadmap.

## Decisions (owner, 2026-10-02)

- Modules are public (MIT); npm scope `@softure-ai` (`softure` is taken by an unrelated user).
- One Postgres schema per module (`auth.users`), with fixed table names.
- Compiled CSS on `--sft-*` tokens: consumers do not need Tailwind.
- Message dictionaries `pl` and `en` from the start.
- Skills live in the separate repo SOFTURE/SKILLS (`@softure-ai/skills`).
- English-only code everywhere (AGENTS.md).
- Releases through GitHub mechanisms: a tag creates the GitHub Release and publishes to npm and
  GitHub Packages.
- Roadmaps follow the FIRE_TRACKER pattern: one main roadmap, queued thematic roadmaps with their
  entries in the backlog.
