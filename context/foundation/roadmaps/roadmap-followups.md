---
project: "SOFTURE AI"
roadmap: followups
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-10-03
backlog: context/backlog/roadmap-followups/
trigger: "every module roadmap (marketing-kit and any later one) is done; the owner promotes it last"
---

# Roadmap followups: gaps found while delivering the other roadmaps

> Entries: [`context/backlog/roadmap-followups/`](../../backlog/roadmap-followups/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote followups`).
>
> The catch-all roadmap (owner, 2026-10-03): every gap or follow-up found while delivering a roadmap lands
> here as an item, not in a loose backlog file, and the roadmap runs last, after the module roadmaps. A new
> gap gets the next `FU-` number, a backlog entry and a row; mark its severity in **Risk**.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **FU-1** | `switch-reader-contract` | Switch-reader contract in core | — | autonomous | proposed |
| **FU-2** | `waitlist-double-opt-in` | Waitlist double opt-in | — | autonomous | proposed |
| **FU-3** | `mailing-consent-sync` | Unsubscribe as consent withdrawal | — | autonomous | proposed |
| **FU-4** | `waitlist-welcome-html` | HTML welcome mail for the waitlist | — | autonomous | proposed |
| **FU-5** | `analytics-client-navigation` | Channel tag on client navigations without Next-Url | — | autonomous | proposed |
| **FU-6** | `billing-reminder-mail` | Reminder mail before access ends | — | autonomous | proposed |
| **FU-7** | `analytics-action-redirect-tag` | Channel tag kept through server action redirects | — | autonomous | proposed |
| **FU-8** | `waitlist-funnel-hook` | Waitlist sign-ups as a funnel step | — | autonomous | proposed |
| **FU-9** | `billing-admin-requests` | Payment requests, revoke and grant history in the billing admin page | — | autonomous | proposed |
| **FU-11** | `billing-refund-one-payment` | Refunds that take back one payment's period | — | autonomous | proposed |
| **FU-12** | `billing-retro-reviews` | Retro research and plan review for MO-1 and MO-2 | — | autonomous | proposed |
| **FU-13** | `marketing-kit-render-ci` | the marketing-kit fixture film renders to a draft MP4 on every push | — | autonomous | proposed |

## Order

1. **FU-1** first: it is HIGH and must land before FIRE_TRACKER adopts the switches; the owner may promote
   or cherry-pick it earlier.
2. **FU-3 ∥ FU-2**, then **FU-4**: FU-2 and FU-4 both own `modules/waitlist/`, so they never run in parallel.

## Items

### FU-1: Switch-reader contract in core
- **Change ID:** `switch-reader-contract`
- **Status:** proposed
- **Outcome:** A switch-reader contract in `@softure-ai/core`: feature-switches provides it, auth asks it with a fallback to its option through an async `isRegistrationClosed(ctx)`, so `auth.registration_closed` flipped in the switches panel takes effect; a report of manifest switches the app did not define.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** How the reader is registered (config registry vs. module manifest); whether reads stay one per request in Next.
- **Risk:** HIGH: must land before FIRE_TRACKER adopts the switches, whose registration switch is flipped from its panel.
- **Baseline:** identity ID-6 `feature-switches`: auth reads `auth.registration_closed` from its own option and `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`, not through `@softure-ai/feature-switches`, because feature-switches depends on auth (the panel's role check) and auth cannot import it back. After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-14.
- **Source:** `modules/auth/src/server/switches.ts`, `modules/feature-switches/README.md`

### FU-2: Waitlist double opt-in
- **Change ID:** `waitlist-double-opt-in`
- **Status:** proposed
- **Outcome:** Double opt-in as a waitlist option: a `confirmed_at` column, a signed confirmation link in the welcome mail, and list mail and consent rows that wait for the confirmation when the option is on.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether consent rows are recorded at sign-up and confirmed later or only at confirmation; expiry of unconfirmed sign-ups.
- **Risk:** MEDIUM: without it a typo or a third party's address joins the list at once.
- **Baseline:** engagement EN-5 `waitlist`: a sign-up counts at once (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-18, NFR-5.
- **Source:** `modules/waitlist/README.md` §12

### FU-5: Channel tag on client navigations without Next-Url
- **Change ID:** `analytics-client-navigation`
- **Status:** proposed
- **Outcome:** Every Next.js client navigation from a tagged page keeps the channel tag, without relying on the router's `Next-Url` header (for example a client component of `/next` that re-applies the tag after router navigations, or a link component that adds it).
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether Next exposes a stable signal for router requests in the proxy; a client component vs. a link wrapper.
- **Risk:** LOW.
- **Baseline:** monetization MO-4 `analytics-channel-tags`: Next strips its `RSC` header before the proxy runs, so the proxy piece recognises a client navigation by the `Next-Url` header the router sends; a navigation without it is not re-tagged (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-23.
- **Source:** `modules/analytics/README.md` §12

### FU-7: Channel tag kept through server action redirects
- **Change ID:** `analytics-action-redirect-tag`
- **Status:** proposed
- **Outcome:** A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether a redirect helper in analytics can wrap auth's actions without auth depending on analytics; how Next renders the redirect target in the action's own response (the proxy never sees a GET for it).
- **Risk:** LOW. The counts after sign-up land under no channel; the sign-up step itself is attributed.
- **Baseline:** monetization MO-5 `analytics-funnel`: after the register action, the account page opens at `/account` without `?z=`, so its beacon counts without a channel (`examples/next-app/e2e/analytics-funnel.spec.ts`). After: the tag survives the redirect, covered by e2e.
- **PRD refs:** FR-23.
- **Source:** MO-5, `examples/next-app/e2e/analytics-funnel.spec.ts` (the account view after sign-up) and `modules/analytics/README.md` §12

### FU-8: Waitlist sign-ups as a funnel step
- **Change ID:** `waitlist-funnel-hook`
- **Status:** proposed
- **Outcome:** The waitlist offers an `onJoined` hook (in the sign-up's transaction, like auth's `onRegistered`) so an app counts waitlist sign-ups in the analytics funnel with `recordFunnelStep` and the channel, without the funnel reading the waitlist's table.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether the hook runs for a repeat sign-up that only widens scopes; the hook's context (the transaction) and its failure policy.
- **Risk:** LOW. Waitlist sign-ups are missing from the funnel report until then.
- **Baseline:** monetization MO-5 `analytics-funnel`: the funnel counts server steps through hooks (`countRegistration` for auth); the waitlist has no hook, so its sign-ups cannot be counted (FIRE_TRACKER's report read `waitlist_signups` directly, which the modules do not allow across schemas). After: an e2e where a waitlist sign-up is counted under its channel.
- **PRD refs:** FR-23.
- **Source:** MO-5, `modules/analytics/README.md` §12 (waitlist sign-ups)

### FU-3: Unsubscribe as consent withdrawal
- **Change ID:** `mailing-consent-sync`
- **Status:** proposed
- **Outcome:** A mailing hook on unsubscribe and on a new explicit consent: an unsubscribe through mailing's link records a withdrawal in `privacy.consents`, and a new explicit sign-up lifts the mailing suppression, so the consent ledger matches what the recipient receives.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Which module owns the mapping from a mail kind to a consent purpose; whether lifting a suppression needs a fresh consent row in the same transaction.
- **Risk:** HIGH: today the ledger can show a granted consent for a recipient who unsubscribed.
- **Baseline:** engagement EN-5 `waitlist`: unsubscribing stops list mail but records no withdrawal, and signing up again does not lift the suppression (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-16, FR-18, FR-21.
- **Source:** `modules/waitlist/README.md` §12, `modules/mailing/README.md`

### FU-4: HTML welcome mail for the waitlist
- **Change ID:** `waitlist-welcome-html`
- **Status:** proposed
- **Outcome:** An option for the app's HTML template of the waitlist welcome mail, next to the text version.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Template shape (function of locale and links vs. a component).
- **Risk:** LOW.
- **Baseline:** engagement EN-5 `waitlist`: the welcome mail is text only (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-18.
- **Source:** `modules/waitlist/README.md` §12

### FU-6: Reminder mail before access ends
- **Change ID:** `billing-reminder-mail`
- **Status:** proposed
- **Outcome:** A reminder mail before an account's trial or paid access ends (and when it has ended), sent once per window through mailing's delivery ledger, next to the in-app notice billing already shows.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** What triggers the run (a scheduled script through ops vs. a request-time check); how accounts in a window are found without scanning every account (accounts without a row derive their trial from `auth.users.created_at`).
- **Risk:** LOW.
- **Baseline:** monetization MO-1 `billing-entitlements`: the reminder windows only drive the in-app badge and notice; no mail is sent (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.

### FU-9: Payment requests, revoke and grant history in the billing admin page
- **Change ID:** `billing-admin-requests`
- **Status:** proposed
- **Outcome:** Invoice requests stored in a billing table and listed in `BillingAdminPage` with a one-click grant; a revoke action; a history of grants per account; optionally a `grant-plan` script; the payment page and the grant form tell a lifetime account apart (today it can still request an invoice, and a dated grant to it is a silent no-op).
- **Prerequisites:** none beyond the main branch (MO-3 may add a payment-events table to share).
- **Unknowns:** One table for manual requests and provider payment events vs. two; retention of invoice details (personal data, privacy contributor).
- **Risk:** LOW.
- **Baseline:** monetization MO-2 `billing-plans-pricing`: requests reach the owner only through `manual({ onRequest })` (the example mails them); the admin grants by email, cannot revoke and sees no history (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12

### FU-11: Refunds that take back one payment's period
- **Change ID:** `billing-refund-one-payment`
- **Status:** proposed
- **Outcome:** A full refund removes only the access the refunded payment granted (its period, or the lifetime it bought), not every paid period of the account; optionally partial refunds handled by a policy.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Storing each payment's granted start and end in `billing.payments`; a shortening entitlement event vs. recomputing access from the remaining payments; how manual grants (no payment row) count.
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-3 `billing-provider-adapter`: `charge.refunded` revokes all paid access (`revoke`), so a refund of one of two stacked months, or of a monthly payment next to a lifetime, takes everything (README §12, plan review W4). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12; `context/archive/2026-10-03-billing-provider-adapter/reviews/plan-review.md` W4

### FU-12: Retro research and plan review for MO-1 and MO-2
- **Change ID:** `billing-retro-reviews`
- **Status:** proposed
- **Outcome:** `research.md` and `reviews/plan-review.md` written after the fact for `billing-entitlements` (MO-1, plan review skipped) and `billing-plans-pricing` (MO-2, research and plan review skipped); every finding that still applies to the code is fixed or filed as its own FU item.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether findings need code changes in `modules/billing/` (then they become their own items).
- **Risk:** LOW.
- **Baseline:** monetization MO-1 and MO-2 skipped phases of the SOFTURE chain (coordinator, 2026-10-03, after the owner's question); their archives have no research.md or plan-review.md. After: both archives carry the missing documents.
- **PRD refs:** FR-22.
- **Source:** `context/archive/2026-10-03-billing-entitlements/`, `context/archive/2026-10-03-billing-plans-pricing/`

### FU-13: The marketing-kit fixture film renders in CI
- **Change ID:** `marketing-kit-render-ci`
- **Status:** proposed
- **Outcome:** A CI job (or a step of an existing one) installs a Chromium, sets `PLAYWRIGHT_CHROMIUM_PATH` and `HYPERFRAMES_BROWSER_PATH`, and runs `MARKETING_KIT_RENDER=1` on `tools/marketing-kit/tests/render.test.ts`.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether the e2e job's Playwright Chromium also serves hyperframes (a headless shell worked locally); the job's run time (about 85 s locally).
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-1 `mk-core-port`: the render test is opt-in and ran locally only (CI's test job has no browser). After: it runs on every push.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/tests/render.test.ts`; `context/archive/2026-10-03-mk-core-port/research.md` (Open questions)

## Owner decisions and checks

(none)

## Done

(nothing yet)

## Decisions (auto)

- The loose follow-up files become this roadmap's entries. → The owner wants every gap in one catch-all roadmap
  at the end (2026-10-03); `identity-followups.md` keeps its entry ticked with a pointer.
- Waitlist placement analytics is not an item here. → It belongs to MO-5 (`analytics-funnel`) of monetization.
- FU-10 (`billing-stripe-sandbox-e2e`) moved to [`roadmap-later`](roadmap-later.md) as LT-1 (owner, 2026-10-03). →
  It waits only on the owner's Stripe secrets (set on 2026-10-05), not on the end of every roadmap. The number
  FU-10 is not reused.
