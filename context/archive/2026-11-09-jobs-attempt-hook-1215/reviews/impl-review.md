---
change_id: jobs-attempt-hook-1215
verdict: approved
---

# Implementation review (auto)

- The hook reads the completion `recordCompletion` returned, so it reports what was stored: a cancel-converted retry
  is `cancelled`, a refused write (`stale`) reports nothing. Checked in `src/server/process.ts` `record()`.
- `outcome` and `code` come from the same branch as the run log line; `paused` stays its own outcome as #1215 lists.
- The event holds no payload, summary or error text. A throwing hook goes through `runHook` (logged by name with
  queue, job and outcome) and the job keeps its state (test "logs a throwing hook").
- No new dependency; jobs still imports nothing from auth (architecture test green).
- Gates: `npx vitest run modules/jobs` 23 files, 355 tests passed; pre-commit typecheck, ESLint and language gate green.
