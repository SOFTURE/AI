---
change_id: mcp-access-operation-context-getter-990
reviewed: 2026-11-03
verdict: approved
---

# Implementation review: mcp-access-operation-context-getter-990

Reviewed commits 3053267 and 1f9fe7c against plan.md and issue #990.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The getter must run inside the error boundary, or a database outage would throw out of the tool handler. | The work resolves the context inside `withToolErrors`; a test answers a failing getter as a tool error without the address. |
| 2 | Minor | Error hints were read once at registration; now they are read per call from the resolved config. | Same sentences for `{ ctx }` (the 952 tests are unchanged and green); with a getter the app's overrides apply, covered by a test. |
| 3 | Minor | `OperationStatusToolOptions` and `OperationCancelToolOptions` became type aliases instead of interfaces. | Same name and members for `{ ctx }` callers; an app that `extends` them would need `&`. No such use in the repository. |
| 4 | Minor | `tests/support.ts` `createConfig` takes the module factory's input (with `messages`). | Test helper only. |

Gates: typecheck green; ESLint and the language gate green; mcp-access tests 480 of 480 green (8 new). Verdict: approved.
