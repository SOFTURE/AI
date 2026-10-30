---
change_id: mcp-access-write-switch-consent-host-904-906
title: "mcp-access: runtime kill switch for writes and the redirect host as its own consent row (issues #904, #906)"
status: archived
roadmap_item: null
issue: [904, 906]
branch: claude/project-thread-kp0yir
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

Close [issue #904](https://github.com/SOFTURE/AI/issues/904): `mcpAccess` declares the manifest switch
`mcp-access.writes_enabled`, read through `readSwitch` of `@softure-ai/core` on every request. Writes need `allowWrites`,
the token's write access and the switch; an undeclared switch keeps today's behaviour. With the switch off, write tools
are not served, the challenge and the default OAuth scope name only `mcp:read`, and the consent page offers no write tick.

Close [issue #906](https://github.com/SOFTURE/AI/issues/906): `ConsentForm` shows where the access code goes as its own
row (label, host in monospace, a hint that the app name is self-declared and the address is not), with new message keys
`consent.redirectLabel` and `consent.redirectHint`; `OAuthConsentPage` accepts `classNames` and passes them on.

## Context

Labels: `pkg: mcp-access`. Both touch the consent page (`src/next/oauth-page.tsx`, `src/ui/consent-form.tsx`), so one
change and one pull request. No version bump: the coordinator releases the batch.

## Constraints

- Backwards compatible: an app without the switch (or without feature-switches) behaves as today.
- A failing switch read never fails a request: it reads as writes off (fail closed), logged by name.

## Notes

- Framing: skipped. Both issues name the gap, the proposal and the adopting app's workaround.
