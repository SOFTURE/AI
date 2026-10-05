# Implementation review: testing-playwright-helpers

Scope: full · Date: 2026-10-05 · Gates: typecheck, lint, test (3450 passed), build, `npx eslint examples`,
example app e2e (119 passed on the local Postgres)

## Verdict

Ready. `@softure-ai/testing/playwright` carries the generic part of FIRE's `integration/infrastructure`
plus the helpers the example's specs repeated; 21 of the example's specs use it, and the whole e2e is
green on it.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | both phases; every generic FIRE file ported or argued out in research |
| Tests | PASS | `tests/playwright-data.test.ts` (pure: addresses, names, `withDatabase`, `waitFor`), `tests/playwright-browser.test.ts` (10 tests in a real Chromium against a local server: auth forms, new client, ui select, list row, links both ways, href, statuses, field assertions) |
| Browser tests in CI | PASS | the `test` job sets `PLAYWRIGHT_CHROMIUM_PATH` (as for marketing-kit); without a browser they skip, a configured missing path fails |
| `expect` outside the runner | PASS | measured: `@playwright/test`'s `expect` works from Vitest, so the helpers' assertions are tested as they run |
| Example e2e | PASS | 119/119; spec edits are mechanical (same steps, same waits); `logIn` without a landing check keeps auth-reset's semantics, `submitLogin` keeps auth.spec's |
| Layering | PASS | no dependency on a module: `AuthFormCopy` is structural, `withDatabase` takes any closable handle; `@playwright/test` is an optional peer |
| Repository shape | PASS | `packages.test.ts` (exports order, build), language gate, links |
| Release safety | PASS | still `"private": true` and 0.1.0; DP-8 publishes it |

## Findings

- Fixed during review: six specs kept an unused `Browser` type import after `openPageAsNewClient`
  replaced their local `openPage` (ESLint).
- Observed, not a defect: the first full e2e run failed `the login-account limit stops guessing on one
  account` on its 30 s timeout while the pre-push Vitest run held all four cores; alone and in a second
  full run it passed (11 scrypt logins under load). The spec is unchanged in what it waits for.
- Gap DF-4 (`auth-testing-account-factory`): accounts created in SQL belong in `@softure-ai/auth/testing`,
  a published package; queued in `deploy-followups`.
- Accepted: `chooseOption` is exercised only by the package's browser tests (the example has no select).
