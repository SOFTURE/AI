# Research: owned jobs and their status (issue #958)

Read on master 35b8fae: `modules/jobs/src/server/{enqueue,admin,maintenance,claim,process,job-row}.ts`,
`src/{contract,handlers,options,progress,summary,schema}.ts`, `src/next/*`, `migrations/0001`, `0007`,
`modules/analytics/src/next/route.ts` (route factory shape), `modules/pwa/src/react/use-is-online.ts`.

## Findings

- `enqueueJob` builds one insert; an `ownerId` is one more column. The dedup path returns an existing live job's id
  whatever its owner: an owner that should not share a job with another owner must put itself in the key. Documented,
  not enforced (a shared job across owners can be intended, e.g. one render per article).
- There is no result on a job today. A handler returns `ok()` or `ok({ summary })`; the summary is code-only and lives
  in the run history. The issue's `resultRef` therefore needs a home: a `result_ref` column on the job, written by a
  successful completion from `ok({ resultRef })`, checked like the summary (an identifier, not free text).
- `last_error` is already a code (never a message), so the failure code the user sees is `last_error` of a `failed`
  job, and `jobs.cancelled` for a cancelled one.
- Pruning deletes finished jobs by status and `finished_at`; `retention.succeededDays` may be 0. An owned job needs a
  floor: kept until both its status retention and an owner retention have passed.
- Route factories in the repo (`analytics`, `mcp-access`) return `{ GET, POST }` objects, take an optional
  `getContext`, and answer `no-store`. A dynamic segment arrives as `context.params` (a promise in Next 16).
- `requestJobCancel` (#951) cancels a pending job or asks a running one to stop. An owner-scoped wrapper only needs the
  owner check first, in the same statement to avoid a check-then-act race: an update fenced by `owner_id`.
- Client code: `./ui` holds the admin panel and imports `@softure-ai/ui`; a hook that only needs React belongs in a
  separate `./react` entry (as in pwa), so an app can use it without ui. jobs must not depend on pwa: the hook listens
  to `online` itself.
- jobs is not in the example app's migration list (`examples/next-app/e2e/migrations.spec.ts`), so a new jobs
  migration needs no e2e change.
