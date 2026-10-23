---
change_id: form-calls-request-json-677
title: "connections, billing: move the hand-written form calls onto requestJson (issue #677)"
status: archived
roadmap_item: null
issue: 677
branch: claude/project-thread-gbysu1
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #677](https://github.com/SOFTURE/AI/issues/677): `connections`' token client (`postForm`) and
`billing`'s Stripe checkout keep their own copy of `requestJson`'s rules only to send a form body. Move both onto
`requestJson({ method: "POST", form, errorSchema })` from `@softure-ai/core` (#676 added `form`, #680 added
`errorSchema`), keeping each package's public codes and behaviour.

## Context

Labels: `enhancement`, `pkg: billing`, `pkg: connections`. Touches `modules/connections/src/server/token-client.ts`
and `modules/billing/src/stripe.ts`, their tests and CHANGELOGs. No release in this change: the coordinator
releases in the next batch.

## Constraints

- No change to either package's public API or codes.
- The OAuth error code (`invalid_grant`, `invalid_client`) is still read from any answer that is not a 429 or 5xx,
  a 200 included; a provider's error description and the raw body never leave.
- Stripe's `error.type`/`error.code` still reach the log, its message never does.

## Out of scope

- `requestWithConnection` forwarding `errorSchema`: neither call needs it, and it would change `connections`'
  public API (excluded by the issue).

## Before the next release

- Raise the `@softure-ai/core` range of `connections` and `billing` to the core release that carries `form` and
  `errorSchema` (`^0.2.4` when core is released as 0.2.4), in the same release as core. It cannot be raised in this
  change: the release rules refuse a range the workspace version (0.2.3) does not satisfy. Against an older core,
  `requestJson` would refuse the `form` option at run time.

## Notes

- Framing: skipped. The issue names the problem and the API.
