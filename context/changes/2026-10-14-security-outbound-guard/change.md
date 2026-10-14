---
change_id: security-outbound-guard
title: "Apps send requests to third-party URLs through an SSRF-guarded helper (issue #479)"
status: planned
roadmap_item: null
issue: 479
branch: claude/project-thread-egsklk
created: 2026-10-14
updated: 2026-10-14
---

## Intent

Close [issue #479](https://github.com/SOFTURE/AI/issues/479). An app that sends a request to a URL someone else
chose (an RFC 8058 one-click unsubscribe address, a webhook target, a link preview) uses `sendGuardedRequest` from
`@softure-ai/security/server` instead of its own guard: every resolved address must be public (`isPublicAddress`,
RFC 6890 special-purpose ranges refused), the check runs in the socket's lookup so DNS rebinding has no window,
redirects are not followed, the request has a time limit and the body is never read past the status.

## Context

Issue #479 (labels `enhancement`, `pkg: security`), proposal quoted:

> `isPublicAddress(address: string): boolean`
> `sendGuardedRequest(url, { method: "GET" | "POST"; headers?; body?; timeoutMs; allowedPorts? /* [443] */ })`
> → `Result<{ status: number }, "security.outbound_invalid_url" | "security.outbound_blocked" | "security.outbound_timeout" | "security.outbound_failed">`
>
> It should have a test seam (an injected request function plus an address predicate) so apps can test against a
> fake server on loopback.

## Constraints

- Owns `modules/security/` only. No change in any adopting app's repository; the migration is in the CHANGELOG,
  README and the issue comment.
- Additive, non-breaking. Node-only (`node:http`, `node:https`, `node:dns`, `node:net`), so it lives in `./server`.

## Notes

- Placement: unlinked one-off from the issue queue (`autonomy.source: issues`), `roadmap_item: null`.
- Framing: skipped. The issue names a concrete gap and contract; nothing about the problem is in doubt.
