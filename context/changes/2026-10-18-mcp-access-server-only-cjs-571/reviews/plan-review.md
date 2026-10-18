---
change_id: mcp-access-server-only-cjs-571
reviewed: 2026-10-18
verdict: approved
---

# Plan review: mcp-access-server-only-cjs-571

Checked plan.md against change.md, research.md, issue #571 and `register.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The issue's `server-only/empty.js` subpath is not exported by the package; resolving `server-only` with the `react-server` condition reaches the same file through the package's own `exports` and survives a future rename of `empty.js`. | No change. |
| 2 | Check | The condition is added only for the `server-only` specifier, so React and every other package keep their regular build (the constraint the comment states). | No change. |
| 3 | Check | `nextResolve` resolves relative to `context.parentURL`, so the app's own `server-only` is found, not one next to the package. | No change. |
| 4 | Check | Fallback keeps the ES import working with `server-only` absent; the existing test pins it. | No change. |
| 5 | Check | The fixture copies the real package shape (exports map, throwing `index.js`) and a no-hook run proves it throws, so the test cannot pass by accident. | No change. |

No Critical findings.
