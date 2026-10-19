---
change_id: deploy-shared-host-compose-guard-600
reviewed: 2026-10-19
verdict: approved
---

# Plan review: deploy-shared-host-compose-guard-600

Checked plan.md against change.md, research.md, issue #600 and `init --edge`'s compose template.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `init --edge` with a database publishes Postgres on `127.0.0.1:5432`, so the guard fails a generated file. | Intended (the neighbour may hold the port); README says to drop the port and use `database.access: compose-exec`. The compliant fixture is the no-database file. |
| 2 | Major | The `www` redirect router covers every path on `www.<domain>`; flagging redirects would fail every `--www` app. | Only auth and allow-list middlewares block; redirects are not checked. |
| 3 | Minor | Middleware references carry `@provider`; a reference to a middleware not in the file (`auth@file`) has an unknown type. | Strip the provider; an unknown middleware is not counted as blocking (documented limit). |
| 4 | Minor | Rule parsing must not try to be a full Traefik parser. | Extract matchers by regex with their negation; a router serves a path when a positive path matcher covers it or it has none, and no negated matcher excludes it. |
| 5 | Check | `yaml` is already a runtime dependency elsewhere at `^2.9.1`; adding it keeps one copy in the lockfile. | No change. |

No Critical findings.
