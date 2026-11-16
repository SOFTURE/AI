# Implementation review: example-on-workers

Verdict: approve after one fix.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | ops `./server` imported the root `@softure-ai/db` (Node-only) although ops declares `./server` Workers-safe; the RP-1 guard caught it. | Fixed: ops imports `@softure-ai/db/request`, needs db ^0.1.15; guard green. |
| 2 | Warning | ops `module.json` and `src/index.ts` still said 0.2.5 after the package bump. | Fixed: 0.2.6 everywhere (module test green). |
| 3 | Warning | `withDatabaseBuild`'s config type carried an index signature, so Next's `NextConfig` (an interface) was not assignable and the example's build failed its typecheck. | Fixed: `turbopack?: { resolveAlias?: object }`, return `T & DatabaseBuildConfig`. |
| 4 | Suggestion | `closeAfterBody` rebuilds the `Response`; a 101 upgrade (WebSocket) has no body and is returned untouched, so nothing is lost. | No change. |
| 6 | Critical | The Node build typechecks `worker.ts`: `@ts-expect-error` on the OpenNext import fails once `.open-next/` exists, and `cloudflare:sockets` had no types of its own. Also `scope.waitUntil` was a method (unbound-method lint). | Fixed in the deploy template and the example: `cloudflare-sockets.d.ts`, `@ts-ignore` with its reason, `waitUntil` an arrow property; typecheck green with and without `.open-next/`. |
| 5 | Suggestion | "Unable to enqueue" on a cancelled chat stream comes from OpenNext's handler, not from the scope (research.md). | No change. |

Drift from plan: none beyond the fixes above. Tests added: db 10, ops 2, mailing 4, observability 1, deploy assertions;
the behaviour tests were seen red without their fix.
