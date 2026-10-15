# Implementation review: billing-jobs

Verdict: **approved** (autonomous, `--auto`).

## Against the plan

- Phase 1: `src/jobs/index.ts` exports `billingJobHandlers`, `createBillingJobHandlers` and `billingJobSchedules`;
  `./jobs` export, optional peer `@softure-ai/jobs` `^0.1.1`, `jobs: "^0.1.1?"` in `module.json` and the inline
  manifest. `tests/jobs.test.ts` covers the schedules' shape, both handlers through `runDueJobs`, the outage retry
  (one mail per account after the retry), the refused account (`failed`, `lastError: mailing.provider_refused`, next
  day resumes) and handler options reaching the run.
- Phase 2: README "Scheduled runs" replaces both cron scripts with the jobs recipe and keeps one combined script for
  apps without jobs; CHANGELOG `## Unreleased` with a four-step migration.

## Findings

- The reminder handler ignores `context.signal`: a run aborted on shutdown keeps sending until it ends, and its result
  is dropped. Harmless (the ledger records every mail; the job is released and runs again without sending twice);
  `limit` bounds a run. Left as is, stated in the plan review.
- The lazy `import("../mailing/index.js")` keeps the entry loadable without `@softure-ai/mailing`; the dist path is the
  same relative path, so the built package resolves it too.
- No Polish, no inline copy, no new error codes. Public text neutral.

## Gates

Green locally: typecheck, lint, test (475 files, 7128 tests passed), build.
