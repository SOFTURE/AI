---
change_id: mcp-access-token-manager-props-589
title: "mcp-access: export the TokenManager prop builder for an app's own token page (issue #589)"
status: archived
roadmap_item: null
issue: 589
branch: claude/project-thread-5a5pk1
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #589](https://github.com/SOFTURE/AI/issues/589): an app whose screens carry their own `<h1>` cannot
mount `McpAccessPage` (its title is `Card`'s `h2`), so it composes `TokenManager` itself and has to copy the
server-side prop builders `McpAccessPage` uses (`toRow`, `toGrant`, `toTool`, `describeStatus`, the date formatting),
because none of them is exported.

## Context

Labels: `enhancement`, `pkg: mcp-access`, `adoption`. mcp-access 0.2.4 is the latest on npm and on master. Releases
are batched by the coordinator: no version bump, the CHANGELOG gets `## Unreleased`. Issue #590 (focus in
`TokenManager`) changes the same component in a parallel thread; master is merged in before the merge.

## Acceptance

- `@softure-ai/mcp-access/next` exports `getTokenManagerProps({ userId })`, which returns every data prop
  `TokenManager` needs (`tools`, `tokens`, `grants` while OAuth is on, `allowWrites`, `maxTokens`, `messages`,
  `locale`), built exactly as `McpAccessPage` builds them.
- `McpAccessPage` renders through the same builder (one code path).
- README and CHANGELOG show an app's own page around `TokenManager` and say what the app drops.

## Notes

- Framing: skipped. The issue states the problem and two proposals; either is enough.

## Decisions (auto)

- Proposal 1 (export the builder) only. Proposal 2 (`titleAs: "h1"`) is not possible without changing
  `@softure-ai/ui`: `Card`'s `headingLevel` is `2 | 3 | 4`, it has no `h1`, so it would widen this change to a second
  package and release. The issue says proposal 1 also covers the cases proposal 2 does not (an app's own frame).
- The builder lives in `/next` and reads the request scope like `McpAccessPage` (config from `getSoftureConfig()`,
  the clock from the module context), with an optional `config`. It takes the `userId` instead of calling
  `requireUser`, so the app keeps its own session check and redirect.
- It also returns `messages` and `locale`, so an app spreads the result into `TokenManager` and adds only the
  actions. `grants` is left out while OAuth is off, matching `TokenManager`'s contract.
- The consent page is out of scope: the issue's builders are the token page's; `ConsentForm` is already composable.
