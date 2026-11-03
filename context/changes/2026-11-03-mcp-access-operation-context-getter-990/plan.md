---
change_id: mcp-access-operation-context-getter-990
status: in_progress
---

# Plan: operation tool registrars take a context getter (issue #990)

Input: change.md, research.md. Complexity: small (one source file pair, tests, docs).

## Phase 1: context getter and exported hints

Files: `modules/mcp-access/src/jobs/operations.ts`, `src/jobs/operation-tasks.ts`, `src/jobs/index.ts`,
`tests/operation-context-getter-990.test.ts` (new).

1. `OperationToolContext`: `{ ctx }` or `{ getContext, config? }`, used by the status, cancel and tasks options.
2. Registration reads the description from `ctx.config`, else `config`, else the English dictionary; no context is
   resolved at registration.
3. Each call resolves the context, runs the read, and answers with `getOperationErrorHints(ctx.config)` through
   `answerValue`, inside `withToolErrors`.
4. Export `getOperationErrorHints(config)` and the `OperationToolContext` type from `/jobs`.
5. Tests: registering with a getter does not call it; tools/list works without calling it; each call calls it once;
   status, not-found hint and cancel answer as with `ctx`; `config` overrides the description; a failing getter is a
   safe tool error; tasks with a getter; the exported hints equal the dictionary's sentences.

## Phase 2: docs

Files: `modules/mcp-access/README.md`, `modules/mcp-access/CHANGELOG.md`.

1. README: the getter alternative and the exported hints under long operations.
2. CHANGELOG `Unreleased` entry.

## Progress

- [ ] Phase 1: context getter and exported hints
- [ ] Phase 2: docs
