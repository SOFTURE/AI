---
change_id: connections-change-hook-945
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (18489c5).

- Scope matches the issue: a hook beside `onReconnectRequired` with provider, account, kind, change, code, actor and
  time; the provider known for a failed callback; a throwing hook logged by kind; an info log line as well.
- Secrets: the event and the line carry ids, the kind, a module error code and a boolean. The provider's own error
  text is never read (the flow already maps it to a code).
- Ordering: every event is sent after the write (upsert, delete, state consumption), so the hook never sees a change
  that was not stored.
- Compatibility: additive option; `disconnect` gains an optional input field.
- Parallel work: #942 and #944 change `tokens.ts`, `store.ts` and `credentials.ts` in other functions; the new code is
  a new helper and a few calls, so the merge stays small. No migration, so no numbering clash with 0002.
- Proof: a test per change kind, the failure cases, the hook throw, and the action's actor.

Verdict: approved, no changes.
