---
change_id: mailing-transport
title: "Mail transport with provider adapters"
status: backlog
roadmap_item: EN-1
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/mailing` exposes `sendMail()` over a `MailProvider` adapter interface with `resend()` as the first adapter: plain-text + HTML bodies, sender and reply-to from config, `Idempotency-Key`, timeout, protection of reserved headers, and a result union `sent | invalid-input | rejected | unavailable`. A fake provider ships for tests and the example app.

## Context

From [`roadmap-engagement.md`](../../../foundation/roadmaps/roadmap-engagement.md), item **EN-1** (queued roadmap `engagement`):

> ### EN-1: Mail transport with provider adapters
> - **Change ID:** `mailing-transport`
> - **Status:** ready
> - **Outcome:** `@softure-ai/mailing` exposes `sendMail()` over a `MailProvider` adapter interface with `resend()` as the first adapter: plain-text + HTML bodies, sender and reply-to from config, `Idempotency-Key`, timeout, protection of reserved headers, and a result union `sent | invalid-input | rejected | unavailable`. A fake provider ships for tests and the example app.
> - **Prerequisites:** roadmap-identity done (core, db, ui, security released).
> - **Unknowns:** Whether HTML templates are plain strings or React email components; how the fake provider exposes sent mail to e2e tests; which provider errors map to `rejected` vs. `unavailable`.
> - **Risk:** medium. Every mail-sending module builds on this contract.
> - **Baseline:** FIRE sends plain text only through a hand-written fetch. After: unit tests per result branch and an e2e scenario that captures a mail through the fake provider.
> - **PRD refs:** FR-16, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/mailing/` (package scaffold, transport, providers), `examples/next-app/e2e/mailing-transport.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
