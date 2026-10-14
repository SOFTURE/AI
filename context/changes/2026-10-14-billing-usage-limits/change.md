---
change_id: billing-usage-limits
title: "billing: usage limits per access state and plan, monthly quotas and consumeUsage (issue #474)"
status: open
roadmap_item: null
issue: 474
branch: claude/project-thread-wnevbm
created: 2026-10-14
updated: 2026-10-14
---

## Intent

An app that sells a metered resource (AI calls per month, exports per month) declares its limits in
`billing({ ... })` per access state and per plan, asks billing what an account's limits are, and
consumes quota through billing: one call that counts usage per calendar month in the app's time zone
and refuses atomically once the quota is used up.

## Context

Issue #474 (labels `enhancement`, `pkg: billing`, `adoption`): an adopting app counts usage in its own
table, resolves limits from the entitlement state with constants of its own, computes month
boundaries with billing's calendar helpers and serialises "count then insert" with its own row lock.
The entitlement row holds no plan, so per-plan limits are not resolvable from billing's public API.

## Constraints

- Additive: existing configs, tables and functions keep working; no option becomes required.
- The plan is resolved from the grants billing already records (provider payments, manual grants);
  the entitlement state machine stays as it is.
- Consumption is atomic per account and meter under concurrency, and usable inside the app's own
  transaction so the quota and the app's write commit or roll back together.
- GDPR: the usage ledger is exported and deleted with the account.
- Out of scope: the job-queue refactor of billing (a separate issue after #471).

## Notes

- Frame skipped: the issue states the gap and a concrete proposal; nothing in it is in doubt.
