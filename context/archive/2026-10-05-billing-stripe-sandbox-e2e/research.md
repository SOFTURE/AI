# Research: billing-stripe-sandbox-e2e

Input: change.md (LT-1). Mode: autonomous.

## Current state

- `@softure-ai/billing`'s `stripe()` (`modules/billing/src/stripe.ts`) creates a one-time Checkout
  session per payment through `fetch`, with the plan as inline `price_data`, the account in
  `client_reference_id` and in the session and PaymentIntent metadata, `customer_email` set, and
  `success_url`/`cancel_url` back to `/payment?checkout=…`. It reads `STRIPE_SECRET_KEY` on every payment.
- The webhook (`modules/billing/src/next/route.ts`, mounted at `/api/billing/webhook` in the example)
  reads `STRIPE_WEBHOOK_SECRET` per request; it handles `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `charge.refunded`, `refund.failed`, `refund.updated` and
  `charge.refund.updated`, and answers 200 for a paid checkout whose account it does not know (logged).
- The example (`examples/next-app/softure.config.ts`) switches to `stripe()` with
  `BILLING_PROVIDER=stripe`, read when the server loads the config, so one `next build` serves both
  providers. The payment page (`/payment?plan=monthly`) shows one "Go to payment" button for a hosted
  provider; the account page (`/account/billing`) shows `[data-status]` (`trial`/`paid`).
- `e2e/billing-stripe.spec.ts` plays Stripe with signed fixtures and a fixed test secret
  (`e2e/outbox.ts`, `playwright.config.ts` webServer env). `modules/billing/tests/stripe-sandbox.test.ts`
  creates a real session with the key in the `test` job of `ci.yml`. Nothing pays or receives Stripe's
  own delivery (README §12).
- `.github/workflows/e2e.yml` job `e2e` builds the packages, installs the example, migrates Postgres,
  builds the app and runs Playwright against `next start`.

## How the webhook reaches CI

- `stripe listen --api-key <key> --forward-to http://localhost:<port>/api/billing/webhook` opens a
  session with Stripe and forwards the account's events to the local server, signed with the session's
  secret; `stripe listen --api-key <key> --print-secret` prints that same secret (it is stable per key
  and device). No public URL and no deployed preview are needed. Chosen.
- A deployed preview would need a host, its own database and a registered endpoint per run. Rejected.
- `--events` limits forwarding to the six types billing reads.
- Every run listening on the same account receives every run's events. Another run's paid checkout
  names an account this run's database does not have: the webhook answers 200 and logs it, so parallel
  runs (two branches) do not disturb each other.
- The Stripe CLI is not on the runner image. It ships as a tarball in its GitHub releases
  (`stripe_<version>_linux_x86_64.tar.gz`); `gh release download` fetches it with the job's token.

## Driving Stripe's hosted page

- The session is created in `pl` or `en` (the app's locale; CI uses `en`). With `customer_email` set
  the email field is filled and read-only.
- The card form: `#cardNumber`, `#cardExpiry`, `#cardCvc`, `#billingName`, and a country select
  `#billingCountry` (a postal code `#billingPostalCode` only for some countries). When the account has
  more than one payment method for PLN (BLIK, Przelewy24), Checkout shows an accordion and the card
  form opens after its "Card" item (`[data-testid="card-accordion-item-button"]`).
- The pay button is `[data-testid="hosted-payment-submit-button"]`. Test card `4242 4242 4242 4242`,
  any future expiry, any CVC, needs no 3-D Secure.
- After the payment Stripe redirects to `success_url`; the webhook may arrive before or after that, so
  the test polls the account page.
- Risk: Stripe changes the hosted page's markup. The selectors are ids and test ids Stripe keeps for
  this kind of testing; a change shows as a red job that names the step, with a trace.

## Cleanup

- Refunding the payment through `POST /v1/refunds` (`payment_intent`) leaves nothing payable, and the
  `charge.refunded` delivery exercises the refund path end to end. The test account and its rows are
  deleted from the database at the end, as in `billing-stripe.spec.ts`.

## SOFTURE modules

Nothing to reuse beyond billing itself; the harness (`e2e/database.ts`, register flow) is the example's.

## Risks

- A Stripe outage or hosted page change turns the job red without a code change. It is a separate job,
  so it names itself and does not hide the other e2e results.
- The key in the job's environment: it is only passed to the steps that need it, never echoed.
