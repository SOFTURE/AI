# Research: billing-e2e-pin-trials-race

## Question

Why does the `pin-trials` e2e case fail with 23503, and how can it stop depending on other specs?

## Findings

- `examples/next-app/playwright.config.ts`: `fullyParallel: true`, `retries: 0`, one Postgres database for
  every worker. A second project, `serial`, runs `*.serial.spec.ts` after the parallel project
  (`dependencies: ["chromium"]`), but nothing limits it to one worker, so its files still run side by side.
- `modules/billing/src/server/entitlements.ts` `pinDerivedTrials`: selects every account without an
  entitlement row (batches of 500), then inserts a row for each. The `pin-trials` script
  (`createPinTrialsScript`) does this for the whole database inside one transaction, dry run included
  (the dry run rolls back).
- At least ten parallel specs delete their accounts while the suite runs (`afterAll` cleanups in
  `auth.spec.ts`, `auth-reset.spec.ts`, `mcp-access.spec.ts`, `mcp-oauth.spec.ts`, `privacy-consents.spec.ts`,
  `billing-reminders.spec.ts`, `billing-pricing.spec.ts`, `feature-switches.spec.ts`,
  `mailing-transport.spec.ts`, and this spec's own other workers).
- **The race (confirmed by reading the code paths):** the script's `SELECT` returns an account another
  worker deletes and commits before the `INSERT` runs; under READ COMMITTED the foreign key check of the
  `INSERT` no longer finds the user and raises 23503. The test never writes such a row itself: it only
  asks the script to report.
- A second race of the same kind: the case asserts `after: {"accountsWithoutRow":0,...}`. That count is a
  new statement inside the script's transaction, so an account another worker registers between the pin
  and the count makes it 1.
- `registration-switch.serial.spec.ts` closes registration for the whole app while it runs; any spec that
  registers an account cannot run beside it.

## Options

1. Scope the script to the test's own accounts: needs a product argument nobody asked for. Rejected.
2. Make `pinDerivedTrials` skip accounts deleted meanwhile (`FOR KEY SHARE OF users`): fixes the 23503 but
   not the `accountsWithoutRow` count, and is a package change with a release. Rejected for this issue.
3. Run the case alone: move it to a `*.serial.spec.ts` file and give the `serial` project one worker, so
   no other spec writes accounts while the script reads the whole database. Chosen.

## Decisions (auto)

- Option 3. The script is database-wide by design, so the test that runs it must own the database while
  it runs; the `serial` project already exists for exactly that.
