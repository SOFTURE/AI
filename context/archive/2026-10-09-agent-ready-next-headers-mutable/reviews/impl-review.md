# Implementation review: agent-ready-next-headers-mutable

Reviewed: the branch diff against plan.md, change.md and issue #304.
Verdict: **approve** (one adjustment applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The first draft of the test imported `NextConfig` from the bare `next` entry. That entry references `next/types/global`, which makes `process.env.NODE_ENV` read-only for the whole tree and broke `vitest.config.mts` and `tools/deploy` in `npm run typecheck`. | Fixed: the test imports the type from `next/dist/server/config-shared.js`, which carries no global augmentation. |
| 2 | Check | Drift from plan: none. `NextHeaderRule` matches Next's `Header` shape (mutable `source`, `headers`); `link-header.ts` still imports nothing (architecture test green). | No change. |
| 3 | Check | The test is red without the fix (`tsc`: TS2322, `() => NextHeaderRule[]` not assignable to `() => Header[] \| Promise<Header[]>`) and green with it. Runtime output unchanged (existing value test passes). | No change. |
| 4 | Check | Docs: the README example is typed `NextConfig` (the case from the issue), CHANGELOG `0.1.2`, version 0.1.2 in `package.json`, `module.json`, `src/index.ts` and `package-lock.json` (0.1.1 is on npm). | No change. |

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the module's tests pass, and the full
`npm test` runs in pre-push.
