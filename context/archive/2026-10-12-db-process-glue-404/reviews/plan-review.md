---
change_id: db-process-glue-404
reviewed: 2026-10-12
verdict: approved
---

# Plan review: db-process-glue-404

Checked plan.md against change.md, research.md, issue #404 and `process.ts`, `shared.ts`, `testing.ts`,
`migrations/migrator.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | With `globalKey`, two module evaluations may pass different `schema` objects; the open `db` keeps the first one's drizzle instance. | Documented in the option's comment; an HMR reload of the schema needs a server restart anyway. |
| 2 | Warning | `closeProcessDatabases()` must also forget states that never opened, or the registry grows with every HMR evaluation without `globalKey`. | Register a state only when `open()` is first called; drop it on close. |
| 3 | Warning | `testing.ts` is imported by module tests; a static `import "esbuild"` there would make esbuild required for every module test. | Dynamic `import("esbuild")` inside the guard, error naming the package when missing. |
| 4 | Check | `queryDatabase` uses parameterized `query(text, values)` on both drivers (AGENTS.md: SQL is always parameterized). | No change. |
| 5 | Check | Defaults unchanged: no `globalKey` keeps today's closure behaviour. | No change. |

No Critical findings.
