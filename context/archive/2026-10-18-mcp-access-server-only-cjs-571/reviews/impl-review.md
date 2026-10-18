---
change_id: mcp-access-server-only-cjs-571
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: mcp-access-server-only-cjs-571

Reviewed: the branch diff against plan.md, change.md and issue #571.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `resolve` adds `react-server` to `context.conditions` only for the `server-only` specifier and passes the rest of the context through, so the parent URL decides which installed copy is found and every other specifier goes straight to `nextResolve`. | No change. |
| 2 | Check | No `format` override on the resolved file: Node reads `empty.js` as CommonJS (the package has no `type`), which `require` and `import` both load. Verified on the built `dist/stdio/register.js` with a `.cjs` and a `.mjs` file, and with `tsx --import` of a `.ts` file in a CommonJS package. | No change. |
| 3 | Check | The `catch` covers only the not-installed case the old hook served; it returns the old `data:` module, so the existing `adoption-gaps-315` fallback test passes unchanged. A different resolution error there was already unreachable for a bare `server-only` import. | No change. |
| 4 | Check | `stdio-register-571.test.ts`: the CommonJS case was red before the fix; the fixture mirrors the published exports map and a run without the hook shows the package's own error, so the green run is not an accident. Each test spawns its own process in a temp directory removed after the suite. | No change. |
| 5 | Check | CHANGELOG `## Unreleased` with the migration (drop the `require.cache` shim), README stdio line updated; no version bump (batched releases). | No change. |
