---
change_id: typescript-7
title: "deps: TypeScript 7 for tsc, the TypeScript 6 API for tools (Dependabot #1206)"
status: open
roadmap_item: null
issue: null
branch: claude/project-thread-3617dd
created: 2026-11-09
updated: 2026-11-09
---

## Intent

Dependabot pull request #1206 bumps the root `typescript` from 6.0.3 to 7.0.2. The owner wants every Dependabot pull
request merged into master. TypeScript 7.0 ships the native compiler without the JavaScript compiler API (its main
export is only `lib/version.cjs`), so as it stands the bump breaks `npm ci` (typescript-eslint 8.72.1 accepts
`typescript <6.1.0`), the typed lint, the source guards in `@softure-ai/testing` and `@softure-ai/ui`, and the tests of
theme-notion and pwa that parse source with the compiler API. Land the bump: `tsc` from TypeScript 7, every consumer of
the compiler API on TypeScript 6, and tell the published packages' consumers how to do the same.

## Notes

- Research recorded in research.md; no frame needed (the breakage is measured, the fix is the upstream recommendation).
- The branch is built on Dependabot's branch, so merging it also marks #1206 merged.
