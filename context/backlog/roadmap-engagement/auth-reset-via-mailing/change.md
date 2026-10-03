---
change_id: auth-reset-via-mailing
title: "Password reset mails through the mailing module"
status: backlog
roadmap_item: EN-4
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

An app that enables both auth and mailing gets password-reset mails without writing a sender: a ready `mailingResetSender()` adapter for the auth reset hook, transactional kind (never suppressed), `pl` and `en` templates, and an e2e scenario from request to new password.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **EN-4** (roadmap `engagement`, main since 2026-10-03):

> ### EN-4: Password reset mails through the mailing module
> - **Change ID:** `auth-reset-via-mailing`
> - **Status:** ready
> - **Outcome:** An app that enables both auth and mailing gets password-reset mails without writing a sender: a ready `mailingResetSender()` adapter for the auth reset hook, transactional kind (never suppressed), `pl` and `en` templates, and an e2e scenario from request to new password.
> - **Prerequisites:** EN-1; ID-5 `auth-password-reset` of roadmap-identity (sender hook) on the main branch.
> - **Unknowns:** Where the adapter lives (auth depends on mailing optionally, or mailing ships the auth adapter); link expiry copy per locale.
> - **Risk:** low.
> - **Baseline:** Identity ships reset with a pluggable sender only. After: the example app resets a password end to end through the fake mail provider.
> - **PRD refs:** FR-12, FR-16.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: the mailing sender adapter for auth reset (in `modules/auth/` or `modules/mailing/`, decided in research), `examples/next-app/e2e/auth-reset-mail.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
