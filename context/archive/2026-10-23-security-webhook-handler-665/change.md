---
change_id: security-webhook-handler-665
title: "security: one handler for third-party webhooks (issue #665)"
status: archived
roadmap_item: null
issue: 665
branch: claude/project-thread-v8yn3j
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #665](https://github.com/SOFTURE/AI/issues/665): the README pattern for a third-party webhook route
(about 25 lines per sender) leaves the ordering and transaction rules in prose and has an unguarded `JSON.parse`
(a body that is not JSON answers 500, so the sender retries forever) and no event validation. Add one host-neutral
`handleWebhook` that fixes the order (size limit, signature over the raw bytes, parse and validate, delivery
recorded and the work run in one transaction) and answers with codes only; export the README's sender presets as
constants; add a helper that builds a signed request for tests. The README example then uses the helper.

## Context

Labels: `enhancement`, `pkg: security`. Reopened after a second look (scoping comment on the issue): keep the scope
small, the owner asked to avoid overengineering. No release in this change: the coordinator releases security in
the next combined release.

## Constraints

- No new entry point and no new dependency: `handleWebhook` lives in `@softure-ai/security/server`, presets and the
  test helper next to `signWebhookBody` in `/signed-request` (and the root entry).
- Answers carry codes only, never error texts or stack traces.
- A failure of the app's work rolls the delivery record back, so the sender's retry is processed.
- Existing functions keep their behaviour.

## Notes

- Framing: skipped. The issue and its scoping comment name the problem and the scope.
