# Plan: billing-reminder-run-388

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases, one package).

## Goal

A reminder job can take over an app's own job without mailing anyone twice (exact end for the scope), and an
operator can dry-run, cap and resume it like any other `runDeliveries` run.

## Key decisions

- **Exact end.** `findStoredCandidates` selects `trialEndsAtMicros` and `paidUntilMicros` next to the dates
  (`sql<string | null>`, the expression in change.md). After the pure rule picks a reminder, `getEndsAtMicros` takes
  the stored column of the reminder's kind (`trial-*` the trial end, `paid-*` the paid end) when it lies within a
  millisecond of `endsAt` (the driver may round or truncate), else `endsAt` times 1000 (a derived trial, or a policy
  that moves the end). BigInt arithmetic, no float.
- **Run.** `sendAccessReminders` finds the due list, then `runDeliveries(ctx, { recipients: due, build }, options)`.
  `build` renders the package's mail, calls `buildMail` (null skips) and returns `{ scope: getScope(reminder), mail }`.
  Defaults: `pauseMs` 500. Everything else passes through. The summary is `{ due: due.length, ...run }`.
- **Dry run.** `buildMail` still runs (the scope and recipient come from it); documented: the template must not write.
- **Docs.** README (feature line and "Reminder mail"), CHANGELOG `## Unreleased`, doc comments.

## Phase 1: The exact end

Tests first in `tests/reminders.test.ts`: a stored trial end and a stored paid end with non-zero microseconds come
back with `endsAtMicros` equal to `extract(epoch …)` computed in SQL; a derived trial end carries `endsAt` in µs.
Then `reminders.ts`.

## Phase 2: The run

Tests in `tests/reminder-mail.test.ts` move to the run summary; new: `dryRun` counts and sends and writes nothing,
`limit` sends that many and counts `remaining`, `retakeUncertain` resends an uncertain claim, `onDelivery` sees each
outcome, a scope built from `endsAtMicros` matches a ledger entry written with the SQL-built scope. Then the code,
README, CHANGELOG, peer range.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The exact end

#### Automated
- [ ] 1.1 Stored ends carry `endsAtMicros` exactly as stored
- [ ] 1.2 Derived ends carry `endsAt` in microseconds

### Phase 2: The run

#### Automated
- [ ] 2.1 `sendAccessReminders` runs on `runDeliveries` and returns its summary plus `due`
- [ ] 2.2 `dryRun`, `limit`, `retakeUncertain` and `onDelivery` pass through
- [ ] 2.3 A scope rebuilt from `endsAtMicros` finds the app's own ledger entry
- [ ] 2.4 README, CHANGELOG, peer range; gates green (typecheck, lint, test)
