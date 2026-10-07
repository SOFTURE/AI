# Plan review: database-shared-handle

Reviewed: `plan.md` against `change.md`, `research.md`, issue #154 and the code at `a872df1` (2026-10-07).
Mode: autonomous. Verdict: **ready**, four findings applied to the plan's execution notes below.

## Checks

| Area | Result |
| --- | --- |
| Covers the issue | Main finding (two handles, two PGlite instances): `database.handle` plus the documented reverse path. Type friction: `Database<TSchema>`. Driver dependencies: optional peers. `createPgliteHandle`: exported. `RESET ALL`: replaced. Every bullet of the issue maps to a plan step. |
| Every opener covered | The eleven adapter call sites, the health route, four commands; the example app's second pool is fixed in Phase 3. `migrations/reference.ts` opens a throwaway in-memory PGlite for introspection, not the app's database: correctly left alone. |
| Core/db dependency direction | Core stays free of db imports; the type comes in by declaration merging, the runtime check lives in db. |
| Build-time evaluation (#155) | The handle is a function and only called by a resolver, so `next build` and `--export-migrations` never open it. |
| Parallel work (#170) | No file of the plan is `adopt.ts`; `index.ts` of db gains export lines only (merge-friendly). |
| Tests seen red | Config, configured resolver, session restore and the ops `pglite://` case all fail on the old code (missing key, missing module, `RESET ALL`, thrown 500). |

## Findings

1. **Warning: `next dev` re-evaluates the config, so the handle function's identity changes on every reload.**
   The resolver's cache (keyed by the function) then calls the new function, which is safe only if the app's
   function returns its own process-wide handle. Fix: the JSDoc of `handle` and db README §3 say so, and the example
   pattern memoizes on `globalThis`. *Applied: Phase 1 JSDoc, Phase 3 README.*
2. **Warning: `openCommandDatabase` closes the app's handle.** Correct for a command's own process (a PGlite
   directory is written back only on close) but wrong if called inside a running server. Fix: its JSDoc limits it to
   command processes; the server-side adapters use `getConfiguredDatabase`, which never closes. *Applied.*
3. **Suggestion: `@softure-ai/db/testing` imports PGlite statically.** With PGlite an optional peer, an app that uses
   the testing entry must install it as a devDependency. Fix: db README §2 states it. *Applied: Phase 3.*
4. **Suggestion: tests that mock `@softure-ai/db` (blog next tests, billing guards) provide `getSharedDatabase`
   only.** After the switch they must provide `getConfiguredDatabase`. *Applied: already listed in Phase 2.*

No blocking findings.
