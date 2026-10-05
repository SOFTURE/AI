# Plan: billing-stripe-sandbox-e2e

Input: change.md, research.md. Complexity: small (one phase: a spec, a Playwright config, a CI job).

## Goal

- `examples/next-app/e2e/billing-checkout.stripe-sandbox.spec.ts` registers an account, pays the
  monthly plan on Stripe's sandbox Checkout with the test card, waits until Stripe's own
  `checkout.session.completed` (forwarded by `stripe listen`) turns the trial into paid, then refunds
  the payment through Stripe's API and waits until `charge.refunded` takes the access back.
- `examples/next-app/playwright.stripe-sandbox.config.ts` runs only `*.stripe-sandbox.spec.ts` against
  its own `next start` with `BILLING_PROVIDER=stripe`, the key and the listener's signing secret;
  `npm run e2e:stripe-sandbox` starts it. The main `playwright.config.ts` ignores those specs.
- `.github/workflows/e2e.yml` gains the job `stripe-sandbox`: with a test-mode `STRIPE_SECRET_KEY` it
  builds the example, installs the Stripe CLI (checksum verified), starts `stripe listen` and runs the
  spec; without the secret it ends green with a notice; with a live key it fails.
- billing's README §12 and the example README say the sandbox payment is covered and how to run it.

**Out of scope:** any change to `@softure-ai/billing`'s code; package versions and publishing (the
parallel release thread); a Stripe Checkout in Polish; BLIK or Przelewy24 payments.

## Approach

**Starting point:** research §Current state: one `next build` serves both providers
(`BILLING_PROVIDER` read at server start); the webhook reads its secret per request.

**Chosen:** `stripe listen` in the job, a separate Playwright config and server on port 3200.
Rejected: a deployed preview (host, database and endpoint per run); adding the spec to the main config
(its server runs the manual adapter and a fixed webhook secret the fixture specs sign with).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Webhook path | `stripe listen --forward-to localhost:3200/api/billing/webhook --events <six types>` | no public URL; the listener's secret signs the deliveries | research |
| Webhook secret | `stripe listen --print-secret`, masked, into `GITHUB_ENV` | not a repository secret (brief) | change.md |
| Job | own job `stripe-sandbox` in `e2e.yml` | a Stripe outage names itself, other e2e results stay readable | research Risks |
| Without the key | gate step: notice and green; live key: error | forks and repos without the secret; never a live key | change.md |
| Stripe CLI | GitHub release tarball via `gh release download`, sha256 checked, version pinned | not on the runner image | research |
| Cleanup | refund through `POST /v1/refunds`, then delete the account | nothing left payable; the refund path runs end to end | research |
| Wait for delivery | `expect.poll` on the account page, 60 s | delivery order versus the redirect is not fixed | research |

## Phase 1: Sandbox spec, its config and the CI job

**Discipline:** test-after (the test is the deliverable; it runs only with the key, in CI).
**Files:** `examples/next-app/e2e/billing-checkout.stripe-sandbox.spec.ts`,
`examples/next-app/playwright.stripe-sandbox.config.ts`, `examples/next-app/playwright.config.ts`,
`examples/next-app/package.json`, `examples/next-app/README.md`, `.github/workflows/e2e.yml`,
`modules/billing/README.md`, `context/foundation/roadmaps/roadmap-later.md`,
`context/backlog/roadmap-later/README.md`.

1. The spec: skipped (with a reason) without a test-mode key; fails fast when `STRIPE_WEBHOOK_SECRET`
   is missing. Register (fresh `cf-connecting-ip`), status `trial`; `/payment?plan=monthly`, click
   "Go to payment", land on `checkout.stripe.com`; open the card item when Checkout shows an accordion;
   fill card, expiry, CVC, name, country (postal code when asked); pay; back on
   `/payment?checkout=success`; poll `/account/billing` until `paid`; read the payment's PaymentIntent id
   from the `payments` row; refund it through the API; poll until `trial`. `afterAll` deletes the account.
2. The config: `testMatch` the sandbox specs, port `E2E_PORT` or 3200, one worker, trace on failure,
   webServer env `BILLING_PROVIDER=stripe`, `APP_ORIGIN`, `MAIL_OUTBOX` and the mailing secret, and the
   Stripe key and secret passed through from the environment.
3. The main config ignores `*.stripe-sandbox.spec.ts`; `package.json` gains `e2e:stripe-sandbox`.
4. The job: gate step on the key; checkout, setup-node, `npm ci`, `npm run build`, example `npm ci`,
   Playwright Chromium, migrate, blog fixtures, app build; install the Stripe CLI; start `stripe listen`
   in the background and wait for "Ready"; `npm run e2e:stripe-sandbox`; on failure upload the
   test results and the listener's log.
5. READMEs: billing §12 replaces the "item LT-1" sentence with what is covered; the example README
   names `npm run e2e:stripe-sandbox` and what it needs.
6. Roadmap: LT-1 row and block `in_progress` while building, `done` at archive.

**Tests:** the spec itself, green in the `stripe-sandbox` job on this branch; the main e2e suite lists
the same specs as before (`playwright test --list`), green in `e2e`.

**Done when:**
- Automated: the `stripe-sandbox` job is green on the branch with the payment and the refund delivered
  by Stripe; the `e2e` job is green and does not run the sandbox spec; gates green (typecheck, lint, test,
  build).

## Risks and rollback

- Stripe's page markup changes → the job is red and names the step; the trace shows the page. Fix the
  selectors.
- A slow delivery → 60 s polling; the listener's log is uploaded on failure.
- Rollback: revert the phase commit; nothing persistent changes (the sandbox payment is refunded).

## Decisions (auto)

- Webhook into CI? → `stripe listen` in the job (research).
- Refund at the end? → yes, through the API: cleanup plus Stripe's real refund delivery.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Sandbox spec, its config and the CI job

#### Automated
- [x] 1.1 The sandbox spec pays, receives Stripe's delivery and the refund, green in the `stripe-sandbox` job — 7a314de
- [x] 1.2 The main e2e suite does not pick up the sandbox spec and stays green — 7a314de
- [x] 1.3 Without a test-mode key the job ends green with a notice; a live key fails it — 7a314de
- [x] 1.4 Gates green (typecheck, lint, test, build) — 7a314de
