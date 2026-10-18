---
change_id: mcp-access-server-only-cjs-571
status: in_progress
---

# Plan: stdio/register resolves server-only to a real file (issue #571)

Input: change.md, research.md. Complexity: small (one hook, tests, docs).

## Phase 1: resolve through the react-server condition (TDD)

Files: `modules/mcp-access/src/stdio/register.ts`, `modules/mcp-access/tests/stdio-register-571.test.ts`.

1. Tests first, in a temp directory holding `node_modules/server-only` with the real package's shape
   (`exports` `react-server` → `empty.js`, `default` → `index.js` that throws):
   - a `.cjs` file with `require("server-only")` prints `loaded` under `--import …/stdio/register` (red today);
   - a `.mjs` file with `import "server-only"` prints `loaded` under the hook;
   - without the hook, the same `.cjs` file fails with the package's own error (the fixture is real);
   - a `.cjs` file that requires another package resolves it as usual under the hook.
2. In `resolve`, for `server-only` only: `nextResolve` with `react-server` added to `context.conditions`; when that
   throws, return today's empty `data:` module. Update the file's comment.
3. The existing fallback test in `adoption-gaps-315.test.ts` keeps passing unchanged.

## Phase 2: docs

`modules/mcp-access/README.md` (the register line: resolves the installed `server-only` the way Next does, `require`
and `import` both), `CHANGELOG.md` `## Unreleased` with the migration (drop the app's `require.cache` shim).

## Progress

- [x] Phase 1: resolve through the react-server condition (4 tests written first; the CommonJS one was red before the change; tsx of a `.ts` file in a CommonJS package checked by hand)
- [ ] Phase 2: docs
