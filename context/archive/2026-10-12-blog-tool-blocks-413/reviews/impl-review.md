---
change_id: blog-tool-blocks-413
---

# Implementation review: blog-tool-blocks-413

Reviewed: the branch diff against plan.md, change.md and issue #413.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The island crosses the server/client boundary as an element (`children` of `BlogToolIsland`), so only the parsed props are serialized; the component itself is a client reference. | No change. |
| 2 | Check | Server HTML and the first client render are the same static markup (`useSyncExternalStore`, `false` server snapshot); the hydration test sees no recoverable error and no console error, then the island with the props. | No change. |
| 3 | Check | `validate` runs only for readable directive attributes; a throw is a finding, as with `numbers`. The catalog's `block-directive` description now names accepted attributes. | No change. |
| 4 | Check | No breaking change: `BlockPlugin` gains one optional member, `checkDirectives` an optional `article` argument; `/ui` imports nothing from Next. | No change. |
| 5 | Note | The schema runs once per hook (render, markdown, validate, numbers) on each directive: a few microseconds per tool line, cheaper than a cache keyed by block. | No change. |
| 6 | Check | Docs: README "Tool blocks" with an example, the `validate` line under directive plugins, the extension list; CHANGELOG `## Unreleased`. No version bump (batched releases). | No change. |

Gates: see plan.md Progress.
