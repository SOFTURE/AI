---
change_id: deploy-shared-host-compose-guard-600
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: deploy-shared-host-compose-guard-600

Checked the diff of `src/testing/shared-host-compose.ts`, its tests, `testing/index.ts`, `package.json`, README and
CHANGELOG against change.md and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every acceptance rule has a test with exact violations; the compose file `init --edge --www` writes (no database) passes. | No change. |
| 2 | Major | A first draft read `PathPrefix` on segment boundaries; Traefik matches a plain string prefix, and a narrower router (`/mcp/tools`) under a bypass path still blocks part of it. | Matchers now answer "overlaps" (some request under the path) and "covers" (all of it); negation excludes only on cover. Tested. |
| 3 | Minor | `String(value)` on a map label could print `[object Object]` (ESLint `no-base-to-string`). | Only scalars are stringified; anything else is an empty value. |
| 4 | Check | External input enters as `unknown` and is narrowed per field; a YAML error is a value, bad options throw. | No change. |
| 5 | Check | `yaml@^2.9.1` matches the version `blog` and `host` use; the lockfile gains one line. | No change. |
| 6 | Check | No version bump; CHANGELOG `## Unreleased` with the app's migration steps. | No change. |

No Critical findings.
