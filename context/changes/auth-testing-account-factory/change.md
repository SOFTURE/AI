---
change_id: auth-testing-account-factory
title: "An account factory in @softure-ai/auth/testing"
status: impl_reviewed
roadmap_item: DF-4
branch: claude/project-thread-8s7r62
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`@softure-ai/auth/testing` exports `createTestAccount(db, { email, password, roles? })`: it writes the
`auth.users` row (the password hashed with auth's own `hashPassword` and scrypt parameters) and the
`auth.user_roles` rows in one transaction, and returns the account. An e2e that is not about
registration creates its account this way and signs in through the login form, instead of filling the
registration form first. The example app's e2e registers through the form only in the tests about
registration (and in those that depend on what registration records: consent, sign-up attribution).
Auth bumps its version; the owner releases it.

## Context

Roadmap deploy-followups, item DF-4 ([`backlog-input.md`](backlog-input.md)). Source: DP-7
(`testing-playwright-helpers`), whose research placed module factories in each module's own `testing`
export (precedent: `@softure-ai/mailing/testing`). PRD FR-35, FR-9.

## Constraints

- Owns: `modules/auth/src/testing/`, `modules/auth/tests/testing.test.ts`, auth's `package.json`,
  `module.json` and README; the example app's e2e specs and a new `e2e/accounts.ts`.
- English only. Test-only code under `src/testing/`, exported as `./testing`, never imported by runtime code.
- Bumps `@softure-ai/auth` to 0.1.6 (no tag, no publish: the owner releases it).

## Notes

- Research done ([`research.md`](research.md)): the roadmap's unknown (handle or drizzle instance), the
  hash parameters, and which e2e tests need the form.
- Framing skipped: the problem and its shape are fixed by the roadmap item and DP-7's research; the
  only open questions are design details, answered in research.
