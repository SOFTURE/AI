---
change_id: ui-testing-guards-403
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: ui-testing-guards-403

Reviewed: the branch diff against plan.md, change.md and issue #403.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. Plan review finding 1 resolved by `buildStylesInput` (it already exports the full theme input, static block included), so the dogfood test needs no copy of the static theme. | No change. |
| 2 | Check | `src/index.ts` (the runtime entry) does not import `typescript`; only `src/testing/` does, and the build emits it under `dist/testing/`. | No change. |
| 3 | Check | Opacity modifiers (`/40`, `/[0.3]`, `/(--alpha)`) and colons inside `[…]`/`(…)` are handled by depth-aware scanning (tested). | No change. |
| 4 | Check | The token guard is not vacuous on the package: injected typos are reported, file and line exact. | No change. |
| 5 | Warning | Importing `@softure-ai/ui/testing` now needs `typescript` for the colour helpers too. Every app that runs these tests is a TypeScript app; documented in README and CHANGELOG. | Accepted. |
| 6 | Check | Docs: README "Source guards" section, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
