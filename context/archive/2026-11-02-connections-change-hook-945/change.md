---
change_id: connections-change-hook-945
title: "connections: a hook and a log line when an admin connects or disconnects an account (issue #945)"
status: archived
roadmap_item: null
issue: 945
branch: claude/project-thread-ze1y3m
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #945](https://github.com/SOFTURE/AI/issues/945): a successful OAuth connect, a saved key and a
disconnect run no hook and write no log line, so an adopting app cannot build an audit trail of admin actions
without wrapping the package's route and actions. After this change the package runs an `onConnectionChanged(event,
ctx)` hook and writes one info log line for every connect, reconnect, disconnect and failed OAuth callback, with the
provider known also for a failed callback (from the pending authorization).

## Context

Labels: `enhancement`, `pkg: connections`, `adoption`. Open in parallel on the same package: #935 (PR #942, token
writes outside the caller's transaction) and #936 (PR #944, refresh failure detail, migration 0002). This change
adds no migration and touches `flow.ts`, `credentials.ts`, `store.ts`, `options.ts`, `contract.ts`; fresh master is
merged before the merge. No release in this change: the coordinator releases the batch.

## Constraints

- Never a credential, token, code or state in the event or the log line: ids and codes only.
- The hook runs after the state is stored; a throwing hook is logged by kind and never fails the call.
- Additive: no change for an app that sets no hook.
- No change to any app repository.

## Notes

- Framing: skipped. The issue names the gap and a concrete proposal.
