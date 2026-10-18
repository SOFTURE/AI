---
change_id: mcp-access-server-only-cjs-571
title: "mcp-access: stdio/register resolves server-only to a real file, so CommonJS require works (issue #571)"
status: archived
roadmap_item: null
issue: 571
branch: claude/project-thread-nsr8bn
created: 2026-10-18
updated: 2026-10-18
archived_at: 2026-10-18
---

## Intent

Close [issue #571](https://github.com/SOFTURE/AI/issues/571): `--import @softure-ai/mcp-access/stdio/register`
resolves `server-only` to a `data:` module, which an ES `import` loads but Node's CommonJS loader reads as a file path
(`ENOENT`). Every script tsx transpiles to CommonJS, and any `.cjs` file, dies on `require("server-only")`, so an
adopting app keeps its own `require.cache` shim. After the change both `require` and `import` load an existing file.

## Context

Labels: `bug`, `pkg: mcp-access`, `adoption`. mcp-access 0.2.3 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- An ES `import "server-only"` keeps working, also where the `server-only` package is not installed.
- Nothing but `server-only` resolves differently; React keeps its regular build.

## Notes

- Framing: skipped. The issue states the problem, a reproduction and a proposed fix.

## Decisions (auto)

- The issue's `resolve("server-only/empty.js")` cannot work: `server-only@0.0.1` exports only `"."`
  (`react-server` → `./empty.js`, `default` → `./index.js`), so the subpath throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  The hook instead resolves `server-only` itself with the `react-server` condition added, which is what Next does:
  the result is the installed `empty.js`, a real CommonJS file, with no `format` override.
- When `server-only` cannot be resolved from the importer at all, the hook keeps today's empty `data:` module, so an
  ES import still loads (a CommonJS require of a package that is not installed failed before the hook existed too).
