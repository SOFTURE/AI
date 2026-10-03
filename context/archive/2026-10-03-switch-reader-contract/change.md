---
change_id: switch-reader-contract
title: "auth.registration_closed flipped in the switches panel takes effect"
status: archived
roadmap_item: FU-1
branch: claude/project-thread-mchs9d
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

An app that defines `auth.registration_closed` in `featureSwitches({ switches })` closes and opens
registration from the switches panel: the register page and the register action follow the stored
value on the next request. An app without feature-switches, or one that does not define the switch,
keeps today's behaviour (auth's `registrationClosed` option with its env override). Auth reaches the
value through a switch-reader contract in `@softure-ai/core`, which feature-switches provides, so no
package imports a module that depends on it. The panel reports the switches that enabled modules
name in their manifests but the app did not define.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-1).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-1** (quoted in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** A switch-reader contract in `@softure-ai/core`: feature-switches provides it, auth asks it with a fallback to its option through an async `isRegistrationClosed(ctx)`, so `auth.registration_closed` flipped in the switches panel takes effect; a report of manifest switches the app did not define.
> - **Unknowns:** How the reader is registered (config registry vs. module manifest); whether reads stay one per request in Next.
> - **Risk:** HIGH: must land before FIRE_TRACKER adopts the switches, whose registration switch is flipped from its panel.

Current state: `modules/auth/src/server/switches.ts` reads the option and
`SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`; `modules/feature-switches/README.md` §7 and §12 tell apps
not to define the switch.

## Constraints

- Exclusively owns: `foundation/core/` (the contract), `modules/auth/` switch reading,
  `modules/feature-switches/` provider and panel report (lane A of the roadmap).
- Shared with other threads: `examples/next-app/` (config, e2e, Playwright config); merge master and
  resolve conflicts autonomously (owner rule 2026-10-03).
- English-only code, comments and commits. User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish; the owner tags releases.

## Notes

- Research: done (`research.md`), it answers the two unknowns.
- Framing: skipped. The problem and its outcome are fixed by the roadmap item and the ID-6 baseline
  (a known gap with a known cause, not a symptom of unclear origin), so there is no problem to reframe.
- FU-7 (`analytics-action-redirect-tag`) waits for this change on master (shared auth files).
- Archived 2026-10-03: auth reads `auth.registration_closed` through core's switch reader, which feature-switches provides, so the panel opens and closes registration; the panel reports manifest switches the app did not define.
