---
change_id: jobs-admin-page-654
status: done
---

# Research: jobs admin page (issue #654)

## What exists

- `modules/jobs/src/server/admin.ts`: `getJob`, `cancelJob` (pending only), `retryJob` (failed or cancelled, refuses
  `jobs.dedup_key_taken`). `maintenance.ts`: `getQueueStats` (counts per status, `due`, `oldestDueAt`, `schedule`
  state). `schedules.ts`: `ScheduleState` (`lastSucceededAt`, `isFailing`, `lastFailureCode`, `isLate`),
  `SCHEDULE_DEDUP_KEY`, `getSchedule`. `sync-items.ts`: `listSyncItems({ source, status, since, limit })`, no reset.
- No `/next` or `/ui` subpath, no `auth`, `ui`, `next` or `react` dependency; `module.json` has no routes.
- `messages/en.ts` holds only `errors` keyed by the code's name (`not_found`), no namespaces.

## Patterns to follow

- `modules/feature-switches` and `modules/connections`: `src/next/{actions,context,messages,pages,panel-rows}.ts`,
  `src/ui/<panel>.tsx` (client, `useActionState`, `createSlotClassGetter`, `FormError`, `Button`), page in a `Card`
  inside `<main>`, `routes` in the manifest with a getter, `tests/architecture.test.ts` (markup guards), action
  tests with mocked `next/headers` / `next/cache` and a real auth session.
- Actions: role first (`authorizeRole`), `zod` with `catch` on every field, unexpected errors as `safeError` codes
  logged by kind, `revalidatePath` outside the try.

## Measured constraint

- `modules/auth/package.json` has `@softure-ai/jobs` as an optional peer and `auth/module.json` has
  `"jobs": "^0.1.1?"`; billing, mcp-access, waitlist, security, blog, analytics and mailing likewise.
  `scripts/build-workspaces.mjs` orders packages by every dependency kind (peers included) and
  `foundation/core/src/config.ts` `orderModules` reports a cycle for any two modules that name each other, optional
  or not. So jobs cannot import `@softure-ai/auth/next`: the guard is injected through the options (change.md).

## Risks

- The page reads three things per render (stats, recent jobs, ledger): bounded by limits (50 jobs, 100 items).
- `retrySyncItem` must reset `attempts`, or `processSyncItem` fails the item again at once (`attempts >= maxAttempts`).
