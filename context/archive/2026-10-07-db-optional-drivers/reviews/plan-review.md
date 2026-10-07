---
change_id: db-optional-drivers
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: db-optional-drivers

Checked `plan.md` against `change.md`, the issue's "Done when", the code that loads drivers
(`foundation/db/src/client.ts`, `testing.ts`, `migrations/reference.ts`), the example app, the generated
Dockerfile (`tools/deploy/templates/Dockerfile.tmpl`) and the CI jobs that build the example.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The image's migrate runner is an esbuild bundle of db (`--external:pg --external:@electric-sql/pglite`). With PGlite absent, esbuild still bundles drizzle's pglite adapter, whose import of PGlite is external; the plan did not verify that the bundle builds and runs with one driver. | Accepted: Phase 2 "Done when" adds the esbuild command of the Dockerfile on the pg-only staged copy, and running the bundle. |
| 2 | Warning | Runtime now has two drizzle copies in a Next app: db's adapters load natively, the modules' query builders are bundled. drizzle compares classes by `entityKind` strings, not `instanceof`, and the measured health route queried every module, but the plan must say what proves it. | Accepted: recorded as a risk; the e2e job (full Playwright suite on the pg-only example with the setting) is the proof, plus the hand check of `/api/health`. |
| 3 | Suggestion | Node reports a missing ESM package as `ERR_MODULE_NOT_FOUND` with `Cannot find package '<name>'`; a CJS loader uses `MODULE_NOT_FOUND`. The helper should match both codes and the package name, so a missing transitive file of an installed driver is not misreported. | Accepted: D4 matches the code and the quoted package name. |
| 4 | Suggestion | `docs/02-module-standard.md` says no package needs `serverExternalPackages`; after this change db does. | Already in Phase 2. |
| 5 | Suggestion | `softure-deploy init` could warn when an app depends on `@softure-ai/db` and its `next.config` lacks the setting. That is the deploy package, which another change is editing now. | Out of scope: filed as #184. |
| 6 | Suggestion | `migrations/reference.ts` opens `pglite://` for `--adopt` and a baseline, so a pg-only app gets the new error there. The message must make sense in that context too. | Accepted: the message names the package and says it is needed for that URL; README §2 lists `--adopt` and the baseline. |

No finding blocks the plan.
