---
change_id: mcp-access-write-switch-consent-host-904-906
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (01cf45f).

- #904 acceptance: switch declared in the manifest, read through `readSwitch` per request, `canWrite` = `allowWrites` and
  token and switch, undeclared keeps behaviour; off hides write tools (endpoint identity), names `mcp:read` in the
  challenge and the default scope, removes the consent tick. README recommendation in phase 3. All covered.
- The decision route must not grant writes while off even if a stale form posts `canWrite`: covered by using
  `isWriteOffered` there, with a test.
- #906 acceptance: own row with label and monospace host, hint, new keys, `classNames` on the page, tests for https and
  a native scheme. Covered in phase 2.
- Compatibility: `isWriteRequested` stays on `AuthorizationRequest`; `isWriteOffered` is added. Removing
  `consent.returnsTo` is a message-key removal; apps overriding it get a type error only if they typed overrides
  strictly; noted in the changelog.
- Cost: one switch row read per MCP request (indexed by name), only while `allowWrites` is on.

Verdict: approved.
