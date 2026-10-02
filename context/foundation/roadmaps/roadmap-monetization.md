---
project: "SOFTURE AI"
roadmap: monetization
version: 1
status: waiting
prd_version: 1
created: 2026-10-02
updated: 2026-10-02
backlog: context/backlog/roadmap-monetization/
trigger: "roadmap-engagement is done and the owner has chosen the payment provider after the manual adapter"
---

# Roadmap monetization: billing and channel analytics

> Entries: [`context/backlog/roadmap-monetization/`](../../backlog/roadmap-monetization/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote monetization`).
>
> Run-wide orders once promoted (read by orchestrators):
> - Push main branch: no. The owner pushes and tags.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Owner at the keyboard: MO-3 (payment provider decision), MO-6 (tags and first staged publishes), MO-7 (adoption run in FIRE_TRACKER).

Wave 3 of the module catalog (`docs/01-module-assessment.md`): entitlements and pricing, and the cookieless
channel analytics that measure where paying users come from. Every module follows `docs/02-module-standard.md`;
adoption in FIRE_TRACKER follows `docs/05-adoption-playbook.md`.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **MO-1** | `billing-entitlements` | `@softure-ai/billing`: trial / paid / read_only state machine in `billing.entitlements`, `requireWriteAccess` | — | autonomous | ready |
| **MO-2** | `billing-plans-pricing` | plans from config, pricing tiles, payment page and a manual payment adapter that grants entitlements | MO-1 | autonomous | ready |
| **MO-3** | `billing-provider-adapter` | the chosen provider (Stripe or Przelewy24) behind `PaymentProvider`: checkout, webhooks, entitlement updates | MO-2 | autonomous | blocked (owner decision: Stripe vs Przelewy24) |
| **MO-4** | `analytics-channel-tags` | `@softure-ai/analytics`: a channel parameter captured, validated and carried across redirects and sign-up | — | autonomous | ready |
| **MO-5** | `analytics-funnel` | daily aggregates (day, channel, step) without cookies or PII, beacon and pixel endpoints, report function | MO-4 | autonomous | ready |
| **MO-6** | `monetization-release` | billing and analytics 0.1.0 published through the release pipeline; READMEs and docs updated | MO-2, MO-5 | owner | ready |
| **MO-7** | `fire-adopt-monetization` | FIRE_TRACKER replaces its access/trial, pricing and channel funnel code with the released modules | MO-6 | owner | ready |

## Order

At most one migration-adding item per parallel group (each module still has its own migrations folder and schema).

1. **Group A (start):** MO-1 (owns `modules/billing/` entitlements, migration) and MO-4 (owns `modules/analytics/`
   channel tagging, no migration).
2. **Group B:** MO-2 (owns `modules/billing/` plans, pricing and payment page, no migration) after MO-1, and MO-5
   (owns `modules/analytics/` funnel counter, migration) after MO-4.
3. **Group C:** MO-3 (owns `modules/billing/` provider adapter, may add a payment-events migration) after MO-2,
   once the owner has chosen the provider.
4. **MO-6** (owner) after MO-2 and MO-5, and after MO-3 when it is unblocked in time; then **MO-7** (owner, runs in FIRE_TRACKER).

Hot shared files: the example app gets one scenario file per item (`examples/next-app/e2e/<module>-*.spec.ts`).
The route guard composition in the example app (`proxy.ts`) is edited only by MO-4.

Risk first: MO-1 (the write guard every paid feature depends on) starts the roadmap.

## Items

### MO-1: Entitlements and the write guard
- **Change ID:** `billing-entitlements`
- **Status:** ready
- **Outcome:** A pure entitlement state machine (`trial | paid | read_only`) with trial length and reminder windows from config; `billing.entitlements` (one row per user, separate from `auth.users`); `getEntitlement()` and `requireWriteAccess()` for app write actions; access badge and notice components with slots and messages; a privacy contributor for export and deletion.
- **Prerequisites:** roadmap-engagement done (privacy registry released).
- **Unknowns:** How a new user gets a trial row (auth `onRegistered` hook vs. lazy creation); an unlimited/lifetime representation; time-zone handling of trial end.
- **Risk:** medium. A wrong guard either blocks paying users or leaks paid features.
- **Baseline:** FIRE keeps `paid_until` / `trial_ends_at` on its users table with a hand-written guard. After: state machine unit tests for every transition and an e2e scenario where a read-only account cannot write.
- **PRD refs:** FR-22, NFR-5.

### MO-2: Plans, pricing tiles and the manual payment flow
- **Change ID:** `billing-plans-pricing`
- **Status:** ready
- **Outcome:** Plans declared in config (name, price, currency, period, features); `<PricingTiles/>` and a payment page; a `manual()` payment adapter (request an invoice, owner grants access through an admin action guarded by auth roles) that updates `billing.entitlements`; a `PaymentProvider` interface ready for real providers.
- **Prerequisites:** MO-1.
- **Unknowns:** The admin surface for granting access (page vs. CLI command); multi-currency formatting through messages; whether plans need a DB table for price history.
- **Risk:** low.
- **Baseline:** FIRE has hard-coded prices and grants access with a script. After: the example app shows plans from config and an admin grant flips a trial to paid (e2e).
- **PRD refs:** FR-22.

### MO-3: Payment provider adapter
- **Change ID:** `billing-provider-adapter`
- **Status:** blocked (owner decision: Stripe vs Przelewy24)
- **Outcome:** A provider adapter implementing `PaymentProvider`: checkout session creation, verified webhooks with idempotent processing, entitlement updates on payment and refund, and test-mode e2e against the provider's sandbox.
- **Prerequisites:** MO-2; the owner's choice of provider and sandbox credentials.
- **Unknowns:** Which provider; webhook signature verification and replay protection; whether a payment-events table is needed for idempotency.
- **Risk:** high. Money and webhooks.
- **Baseline:** Only the manual adapter exists. After: a sandbox payment turns a trial into paid without owner action.
- **PRD refs:** FR-22, NFR-5.

### MO-4: Channel tags
- **Change ID:** `analytics-channel-tags`
- **Status:** ready
- **Outcome:** A configurable channel parameter (name, pattern, length) read on entry, carried through redirects and the referer, exposed to the app and to auth's `onRegistered` hook for attribution; a composable middleware piece for `proxy.ts` that does not mix with the auth route guard.
- **Prerequisites:** roadmap-engagement done.
- **Unknowns:** Where attribution is stored without a cookie (first-party query propagation only?); interaction with the auth guard ordering in `proxy.ts`.
- **Risk:** low.
- **Baseline:** FIRE mixes channel redirects into its auth proxy. After: unit tests on parsing and propagation, e2e that a tagged visit reaches sign-up with its channel.
- **PRD refs:** FR-23.

### MO-5: Cookieless funnel counter
- **Change ID:** `analytics-funnel`
- **Status:** ready
- **Outcome:** `analytics.funnel_counts` holding daily aggregates per (day, channel, step) with steps from config, a cap on new channels per day with an overflow bucket, a `sendBeacon` helper plus a POST beacon and GIF pixel endpoint with a body size limit, day boundaries in the configured time zone, and a report function returning the funnel per channel.
- **Prerequisites:** MO-4.
- **Unknowns:** How the report reads other modules' counts (sign-ups, waitlist) without cross-schema coupling; retention of old aggregates.
- **Risk:** low. No personal data is stored.
- **Baseline:** FIRE counts its domain wizard steps with a report script. After: configurable steps counted in the example app, report covered by unit tests on PGlite.
- **PRD refs:** FR-23, NFR-5.

### MO-6: Monetization modules release
- **Change ID:** `monetization-release`
- **Status:** ready
- **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher), including MO-3 if it is done in time; module READMEs and status lines updated; a finish review across the merged items.
- **Prerequisites:** MO-2, MO-5 (MO-3 optional).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MO-7: FIRE_TRACKER adopts billing and analytics
- **Change ID:** `fire-adopt-monetization`
- **Status:** ready
- **Outcome:** Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts billing and analytics: trial and paid columns move from its users table into `billing.entitlements`, its funnel table moves into `analytics.funnel_counts`, its own implementations and unit tests are deleted, its integration suite stays green, and gaps become issues in SOFTURE/AI.
- **Prerequisites:** MO-6.
- **Unknowns:** Mapping FIRE's early-account rules and prices into plan config; keeping historical funnel rows across the move.
- **Risk:** high. Production data and paid access are moved.
- **Baseline:** FIRE runs its own copies. After: those copies are gone, FIRE CI is green, CHANGELOG entries say `verified in: FIRE_TRACKER@<sha>`.
- **PRD refs:** FR-26, G-2.

## Owner decisions and checks

- [ ] **MO-3**: choose the payment provider to implement after the manual adapter (Stripe or Przelewy24) and provide test-mode credentials.
- [ ] **MO-6**: approve the first (staged) publish of billing and analytics on npmjs.com, then add a trusted publisher for each.
- [ ] **MO-7**: schedule the FIRE_TRACKER adoption run; confirm a production database copy is available for the `--adopt --plan` dry run.

## Done

(nothing yet)

## Decisions (auto)

- The provider adapter is a separate, blocked item instead of part of MO-2. → The manual adapter ships value without waiting for the provider decision.
- Channel tags (MO-4) and the funnel counter (MO-5) are split. → Tagging has no table and unblocks attribution of sign-ups early; the counter adds the only analytics migration.
- MO-6 does not wait for MO-3. → A blocked provider decision must not hold back the release of the rest.
