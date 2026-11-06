# Plan: ci-per-module-hermetic-stripe

## Steps

1. `scripts/ci/lockfile-changes.mjs`: which workspaces a lockfile change reaches (Node resolution over both
   lockfiles; root tools reach all). `affected.mjs`: the lockfile is no longer a shared path; its reach comes from the
   base lockfile (GitHub API) against the checkout; new `test-paths` output.
2. `ci.yml`: the test job needs `changes`, a pull request tests only `test-paths` (as file lists, since Vitest
   filters are substrings); no Stripe key.
3. `stripe-sandbox.yml` (schedule + dispatch): billing's sandbox API test and the browser payment; removed from
   `e2e.yml`.
4. Fake Stripe: server, `fake-stripe` Playwright project with a second app server (`BILLING_PROVIDER=stripe`,
   `STRIPE_API_BASE`), spec; `softure.config.ts` reads `STRIPE_API_BASE`; billing accepts a loopback HTTP page.
5. Tests: `tests/repo/ci-lockfile-changes.test.ts`, `ci-affected.test.ts`, `ci-workflows.test.ts`,
   `test-gates.test.ts`, billing `stripe.test.ts`. Docs: AGENTS.md, READMEs, billing CHANGELOG.

## Acceptance

- Repository tests and billing's tests pass; the fake-stripe spec passes locally and in CI; the whole example e2e
  passes with the second server.
- The PR's `changed areas` job prints a scoped `test-paths`.

## Progress

- [x] 1-5 implemented. Local: `tests/repo` 906 passed; billing `stripe.test.ts` 21 passed; `npx playwright test
  --project=fake-stripe` passed (2.7 s); `npx eslint examples` clean.
- [x] Whole example e2e locally with the second server: 129 passed (3.1 min). CI on the pull request next.
