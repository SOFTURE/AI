---
project: "SOFTURE AI"
roadmap: followups
version: 1
status: ready
prd_version: 1
created: 2026-10-03
updated: 2026-10-04
backlog: context/backlog/roadmap-followups/
---

# Roadmap followups: gaps found while delivering the other roadmaps

> Entries: [`context/backlog/roadmap-followups/`](../backlog/roadmap-followups/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
>
> Promoted by the owner on 2026-10-03, when the marketing-kit roadmap closed (archived in
> [`archive/2026-10-03-4-roadmap.md`](archive/2026-10-03-4-roadmap.md)), as the last roadmap. MK-8 (marketing-kit
> release), EN-9 (engagement release) and MO-6 (monetization release) are carried over here as blocked owner items:
> the owner publishes them in one batch at the keyboard on Monday 2026-10-05.
>
> The catch-all roadmap (owner, 2026-10-03): every gap or follow-up found while delivering a roadmap lands
> here as an item, not in a loose backlog file. A new gap gets the next `FU-` number, a backlog entry and a row;
> mark its severity in **Risk**, and say in **Mode** whether it needs the owner at the keyboard.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
> - Owner at the keyboard: MK-8, EN-9 and MO-6 only (carried over). Every FU item runs autonomously in the cloud
>   (see "Owner at the keyboard?" below).
>
> Queued after this one (WORKFLOW §5.1, files in `roadmaps/`, entries in `context/backlog/`):
> 1. [`roadmap-later`](roadmaps/roadmap-later.md): items parked until an owner step (secrets, accounts) is done.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **EN-9** | `engagement-release` | mailing, waitlist, mcp-access and privacy 0.1.0 published through the release pipeline; READMEs and docs updated | EN-1…EN-8 (done) | owner | blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05) |
| **MO-6** | `monetization-release` | billing and analytics 0.1.0 published through the release pipeline; READMEs and docs updated | MO-1…MO-5 (done) | owner | blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05) |
| **MK-8** | `marketing-kit-release` | `@softure-ai/marketing-kit` 0.1.0 published through the release pipeline, README complete | MK-1…MK-7 (done) | owner | blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05) |
| **FU-1** | `switch-reader-contract` | Switch-reader contract in core | — | autonomous | done |
| **FU-2** | `waitlist-double-opt-in` | Waitlist double opt-in | FU-3 | autonomous | done |
| **FU-3** | `mailing-consent-sync` | Unsubscribe as consent withdrawal | — | autonomous | done |
| **FU-4** | `waitlist-welcome-html` | HTML welcome mail for the waitlist | FU-2 | autonomous | done |
| **FU-5** | `analytics-client-navigation` | Channel tag on client navigations without Next-Url | — | autonomous | done_code (2026-10-03; waiting: MO-6 release of `@softure-ai/analytics`) |
| **FU-6** | `billing-reminder-mail` | Reminder mail before access ends | FU-9 | autonomous | proposed |
| **FU-7** | `analytics-action-redirect-tag` | Channel tag kept through server action redirects | FU-1, FU-5 | autonomous | done_code (2026-10-04; waiting: MO-6 release of `@softure-ai/analytics` and the next `@softure-ai/auth` release) |
| **FU-8** | `waitlist-funnel-hook` | Waitlist sign-ups as a funnel step | FU-4 | autonomous | done |
| **FU-9** | `billing-admin-requests` | Payment requests, revoke and grant history in the billing admin page | FU-11 | autonomous | done |
| **FU-11** | `billing-refund-one-payment` | Refunds that take back one payment's period | — | autonomous | done |
| **FU-12** | `billing-retro-reviews` | Retro research and plan review for MO-1 and MO-2 | — | autonomous | done |
| **FU-13** | `marketing-kit-render-ci` | the marketing-kit fixture film renders to a draft MP4 on every push | — | autonomous | done |
| **FU-14** | `marketing-kit-schema-docs` | every key of the marketing.json JSON Schema carries a description | — | autonomous | done_code (2026-10-03; waiting: owner editor check, MK-8 release) |
| **FU-15** | `marketing-kit-desktop-16x9` | desktop 16:9 films recorded in a browser frame instead of a phone | FU-16 | autonomous | proposed |
| **FU-16** | `marketing-kit-layout-overrides` | per-format layout overrides (caption box, persona, end card) in marketing.json | FU-14 | autonomous | done_code (2026-10-03; waiting: MK-8 release) |
| **FU-17** | `marketing-kit-og-glyphs` | OG images refuse copy the brand fonts cannot draw | — | autonomous | done_code (2026-10-03; waiting: MK-8 release) |
| **FU-18** | `marketing-kit-screenshot-variants` | screenshots at a device scale and in both colour schemes | FU-14 | autonomous | done_code (2026-10-04; waiting: MK-8 release) |
| **FU-19** | `marketing-kit-hook-shot-words` | opening shots after the first without a `word` are refused when the config loads | FU-14 | autonomous | proposed |
| **FU-20** | `billing-partial-refunds` | partial refunds take back access by a policy | FU-11 | autonomous | proposed |
| **FU-21** | `billing-refund-manual-lifetime` | a manual lifetime grant survives a refunded paid lifetime | FU-9 | autonomous | proposed |
| **FU-22** | `billing-grant-plan-script` | a `grant-plan` ops script grants and revokes plans without the admin page | FU-9 | autonomous | proposed |
| **FU-23** | `marketing-kit-og-subset-fonts` | OG images use every subset file of a weight | FU-17 | autonomous | proposed |
| **FU-24** | `billing-existing-accounts` | existing accounts keep their access when billing is enabled (import, trial floor, pinned trials) | FU-22 | autonomous | proposed |
| **FU-25** | `billing-stripe-currency-units` | Stripe charges the plan's price in every currency (special-case units) | FU-24 | autonomous | proposed |
| **FU-26** | `billing-guard-race-tests` | billing guards and lock races tested where they can fail | FU-25 | autonomous | proposed |
| **FU-27** | `billing-invoice-request-hygiene` | invoice requests stored before the owner's mail, validated, expired and priced | FU-26 | autonomous | proposed |
| **FU-28** | `auth-page-redirect-tag` | a signed-in visitor's redirect from a tagged login page keeps the tag | FU-7 | autonomous | proposed |

## Order

Lanes follow file ownership: items in one lane share files (a module, its migrations, `schema.ts`), so they run one
after another; different lanes run in parallel, up to 4 at once.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: switches | FU-1 | `foundation/core/`, `modules/auth/`, `modules/feature-switches/` |
| B: waitlist and consent | FU-3 → FU-2 → FU-4 → FU-8 | `modules/waitlist/` (FU-3 also `modules/mailing/`, `modules/privacy/`) |
| C: billing | FU-11 → FU-9 → FU-6 → FU-20 → FU-21 → FU-22 → FU-24 → FU-25 → FU-26 → FU-27; FU-12 any time | `modules/billing/` and its migrations; FU-12 writes documents only (archives and followup entries) |
| D: analytics | FU-5 → FU-7 → FU-28 (FU-7 also after FU-1) | `modules/analytics/` channel propagation; FU-7 may touch auth's redirects |
| E: marketing-kit config | FU-14 → FU-16 → FU-15; FU-14 → FU-18 → FU-19 | `tools/marketing-kit/src/config/schema.ts`, `schema/`, `src/compose/` (FU-15, FU-16) |
| F: independent | FU-13, FU-17 → FU-23 | `.github/workflows/ci.yml`; `tools/marketing-kit/src/og/` |

1. **First wave: FU-1, FU-3, FU-11, FU-14.** The two HIGH items first (FU-1 must land before FIRE_TRACKER
   adopts the switches; FU-3 fixes a consent ledger that can contradict an unsubscribe), then the MEDIUM refund
   fix and the schema descriptions that every later marketing-kit config item extends.
2. **Each free slot** takes the first item of this list whose lane is idle and whose dependencies are on `master`:
   FU-2, FU-5, FU-13, FU-17, FU-9, FU-16, FU-18, FU-4, FU-7, FU-12, FU-6, FU-15, FU-8, FU-19, FU-20, FU-21, FU-22, FU-23, FU-24, FU-25, FU-26, FU-27, FU-28.
3. **MK-8, EN-9 and MO-6** (owner, carried over): the owner's batch release on 2026-10-05; they wait for no FU item,
   and no FU item waits for them.

Example app wiring (`examples/next-app/`) and the e2e lists are touched by several lanes; `master` is the source of
truth and each thread merges it and resolves the conflicts itself.

## Owner at the keyboard?

Assessed on 2026-10-03 against what a cloud session cannot do: secrets, provider accounts, paid API calls, the
owner's own machine, a product decision only the owner can make, or a change in FIRE_TRACKER.

| ID | Needs the owner | Why |
| --- | --- | --- |
| MK-8, EN-9, MO-6 | yes | first (staged) npm publish and trusted publisher on npmjs.com are the owner's steps |
| FU-1 | no | code in core, auth and feature-switches; unit and e2e tests on the local Postgres |
| FU-2 | no | an opt-in waitlist option (off by default), so no product decision; expiry is a configurable default |
| FU-3 | no | mailing hooks and privacy wiring; the fake mail provider covers the e2e |
| FU-4 | no | an optional HTML template next to the text mail; the fake mail provider covers it |
| FU-5 | no | analytics proxy or client component; covered by the example app's e2e |
| FU-6 | no | a mail through mailing's delivery ledger and fake provider; the module ships a run function, scheduling stays with the app |
| FU-7 | no | analytics redirect helper; covered by the funnel e2e |
| FU-8 | no | an `onJoined` hook in the waitlist; covered by an e2e |
| FU-9 | no | billing migration and admin page; manual provider only, no Stripe secrets |
| FU-11 | no | refund handling tested with signed webhook fixtures, no Stripe secrets (the sandbox payment is LT-1) |
| FU-12 | no | documents written after the fact; findings that need code become their own FU items |
| FU-13 | no | a CI job on GitHub's runners (Chromium, ffmpeg); the fixture film uses no paid TTS |
| FU-14 | no | `.describe()` on the zod schema and the regenerated JSON Schema |
| FU-15 | no | recorder desktop mode and a browser-frame layout, rendered from the fixture project |
| FU-16 | no | a validated `layout` section merged into the geometry table |
| FU-17 | no | a glyph check against the loaded fonts; tested with a subset font |
| FU-18 | no | Playwright device scale and colour schemes; tested against the static fixture page |
| FU-19 | no | a refinement in the config schema and a config test |
| FU-20 | no | a refund policy in billing with a documented default; signed webhook fixtures, no Stripe secrets |
| FU-21 | no | reads FU-9's grant history in the refund; unit tests on PGlite |
| FU-22 | no | an ops script on `grantPlanManually` and `revokeManualGrant`, dry run by default; unit tests on PGlite |
| FU-23 | no | font registration in `src/og/fonts.ts`; tested with Inter's `latin` and `latin-ext` files |
| FU-24 | no | an ops script or server function on the local Postgres; FIRE_TRACKER only reads the result (its own roadmap migrates) |
| FU-25 | no | unit tests on the Checkout request body; no Stripe secrets or sandbox call |
| FU-26 | no | unit tests, Postgres tests on the CI service and one e2e |
| FU-27 | no | a migration and server changes tested on PGlite; the fake mail provider covers the e2e |
| FU-28 | no | auth's page redirect through the same rewrite; covered by the example app's e2e |

## Items

### EN-9: Engagement modules release (carried over)
- **Change ID:** `engagement-release`
- **Status:** blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/mailing`, `@softure-ai/waitlist`, `@softure-ai/mcp-access` and `@softure-ai/privacy` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across EN-1…EN-8.
- **Prerequisites:** EN-1…EN-8 (done, see [`archive/2026-10-03-2-roadmap.md`](archive/2026-10-03-2-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MO-6: Monetization modules release (carried over)
- **Change ID:** `monetization-release`
- **Status:** blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across MO-1…MO-5.
- **Prerequisites:** MO-1…MO-5 (done, see [`archive/2026-10-03-3-roadmap.md`](archive/2026-10-03-3-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MK-8: marketing-kit release (carried over)
- **Change ID:** `marketing-kit-release`
- **Status:** blocked (carried over from marketing-kit: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:**
  - `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
  - The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
  - An example `marketing.json` and brand ship in `examples/`.
- **Prerequisites:** MK-1…MK-7 (done, see [`archive/2026-10-03-4-roadmap.md`](archive/2026-10-03-4-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** package absent from npm. After: `npx @softure-ai/marketing-kit --help` works from npm and from the GitHub Release tarball.
- **PRD refs:** FR-24, FR-25, FR-2.

### FU-1: Switch-reader contract in core
- **Change ID:** `switch-reader-contract`
- **Status:** done
- **Input:** [`archive/2026-10-03-switch-reader-contract/change.md`](../archive/2026-10-03-switch-reader-contract/change.md)
- **Outcome:** A switch-reader contract in `@softure-ai/core`: feature-switches provides it, auth asks it with a fallback to its option through an async `isRegistrationClosed(ctx)`, so `auth.registration_closed` flipped in the switches panel takes effect; a report of manifest switches the app did not define.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** How the reader is registered (config registry vs. module manifest); whether reads stay one per request in Next.
- **Risk:** HIGH: must land before FIRE_TRACKER adopts the switches, whose registration switch is flipped from its panel.
- **Baseline:** identity ID-6 `feature-switches`: auth reads `auth.registration_closed` from its own option and `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`, not through `@softure-ai/feature-switches`, because feature-switches depends on auth (the panel's role check) and auth cannot import it back. After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-14.
- **Source:** `modules/auth/src/server/switches.ts`, `modules/feature-switches/README.md`

### FU-2: Waitlist double opt-in
- **Change ID:** `waitlist-double-opt-in`
- **Status:** done
- **Input:** [`archive/2026-10-03-waitlist-double-opt-in/change.md`](../archive/2026-10-03-waitlist-double-opt-in/change.md)
- **Outcome:** Double opt-in as a waitlist option: a `confirmed_at` column, a signed confirmation link in the welcome mail, and list mail and consent rows that wait for the confirmation when the option is on.
- **Prerequisites:** FU-3 on `master` (shared files, see Order).
- **Unknowns:** Whether consent rows are recorded at sign-up and confirmed later or only at confirmation; expiry of unconfirmed sign-ups.
- **Risk:** MEDIUM: without it a typo or a third party's address joins the list at once.
- **Baseline:** engagement EN-5 `waitlist`: a sign-up counts at once (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-18, NFR-5.
- **Source:** `modules/waitlist/README.md` §12

### FU-5: Channel tag on client navigations without Next-Url
- **Change ID:** `analytics-client-navigation`
- **Status:** done_code (2026-10-03; waiting: MO-6 release of `@softure-ai/analytics`)
- **Input:** [`archive/2026-10-03-analytics-client-navigation/change.md`](../archive/2026-10-03-analytics-client-navigation/change.md)
- **Outcome:** Every Next.js client navigation from a tagged page keeps the channel tag, without relying on the router's `Next-Url` header (for example a client component of `/next` that re-applies the tag after router navigations, or a link component that adds it).
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether Next exposes a stable signal for router requests in the proxy; a client component vs. a link wrapper.
- **Risk:** LOW.
- **Baseline:** monetization MO-4 `analytics-channel-tags`: Next strips its `RSC` header before the proxy runs, so the proxy piece recognises a client navigation by the `Next-Url` header the router sends; a navigation without it is not re-tagged (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-23.
- **Source:** `modules/analytics/README.md` §12

### FU-7: Channel tag kept through server action redirects
- **Change ID:** `analytics-action-redirect-tag`
- **Status:** done_code (2026-10-04; waiting: MO-6 release of `@softure-ai/analytics` and the next `@softure-ai/auth` release)
- **Input:** [`archive/2026-10-03-analytics-action-redirect-tag/change.md`](../archive/2026-10-03-analytics-action-redirect-tag/change.md)
- **Outcome:** A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).
- **Prerequisites:** FU-1, FU-5 on `master` (shared files, see Order).
- **Unknowns:** Whether a redirect helper in analytics can wrap auth's actions without auth depending on analytics; how Next renders the redirect target in the action's own response (the proxy never sees a GET for it).
- **Risk:** LOW. The counts after sign-up land under no channel; the sign-up step itself is attributed.
- **Baseline:** monetization MO-5 `analytics-funnel`: after the register action, the account page opens at `/account` without `?z=`, so its beacon counts without a channel (`examples/next-app/e2e/analytics-funnel.spec.ts`). After: the tag survives the redirect, covered by e2e.
- **PRD refs:** FR-23.
- **Source:** MO-5, `examples/next-app/e2e/analytics-funnel.spec.ts` (the account view after sign-up) and `modules/analytics/README.md` §12

### FU-8: Waitlist sign-ups as a funnel step
- **Change ID:** `waitlist-funnel-hook`
- **Status:** done
- **Input:** [`archive/2026-10-04-waitlist-funnel-hook/change.md`](../archive/2026-10-04-waitlist-funnel-hook/change.md)
- **Outcome:** The waitlist offers an `onJoined` hook (in the sign-up's transaction, like auth's `onRegistered`) so an app counts waitlist sign-ups in the analytics funnel with `recordFunnelStep` and the channel, without the funnel reading the waitlist's table.
- **Prerequisites:** FU-4 on `master` (shared files, see Order).
- **Unknowns:** Whether the hook runs for a repeat sign-up that only widens scopes; the hook's context (the transaction) and its failure policy.
- **Risk:** LOW. Waitlist sign-ups are missing from the funnel report until then.
- **Baseline:** monetization MO-5 `analytics-funnel`: the funnel counts server steps through hooks (`countRegistration` for auth); the waitlist has no hook, so its sign-ups cannot be counted (FIRE_TRACKER's report read `waitlist_signups` directly, which the modules do not allow across schemas). After: an e2e where a waitlist sign-up is counted under its channel.
- **PRD refs:** FR-23.
- **Source:** MO-5, `modules/analytics/README.md` §12 (waitlist sign-ups)

### FU-3: Unsubscribe as consent withdrawal
- **Change ID:** `mailing-consent-sync`
- **Status:** done
- **Input:** [`archive/2026-10-03-mailing-consent-sync/change.md`](../archive/2026-10-03-mailing-consent-sync/change.md)
- **Outcome:** A mailing hook on unsubscribe and on a new explicit consent: an unsubscribe through mailing's link records a withdrawal in `privacy.consents`, and a new explicit sign-up lifts the mailing suppression, so the consent ledger matches what the recipient receives.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Which module owns the mapping from a mail kind to a consent purpose; whether lifting a suppression needs a fresh consent row in the same transaction.
- **Risk:** HIGH: today the ledger can show a granted consent for a recipient who unsubscribed.
- **Baseline:** engagement EN-5 `waitlist`: unsubscribing stops list mail but records no withdrawal, and signing up again does not lift the suppression (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-16, FR-18, FR-21.
- **Source:** `modules/waitlist/README.md` §12, `modules/mailing/README.md`

### FU-4: HTML welcome mail for the waitlist
- **Change ID:** `waitlist-welcome-html`
- **Status:** done
- **Input:** [`archive/2026-10-03-waitlist-welcome-html/change.md`](../archive/2026-10-03-waitlist-welcome-html/change.md)
- **Outcome:** An option for the app's HTML template of the waitlist welcome mail, next to the text version.
- **Prerequisites:** FU-2 on `master` (shared files, see Order).
- **Unknowns:** Template shape (function of locale and links vs. a component).
- **Risk:** LOW.
- **Baseline:** engagement EN-5 `waitlist`: the welcome mail is text only (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-18.
- **Source:** `modules/waitlist/README.md` §12

### FU-6: Reminder mail before access ends
- **Change ID:** `billing-reminder-mail`
- **Status:** proposed
- **Outcome:** A reminder mail before an account's trial or paid access ends (and when it has ended), sent once per window through mailing's delivery ledger, next to the in-app notice billing already shows.
- **Prerequisites:** FU-9 on `master` (shared files, see Order).
- **Unknowns:** What triggers the run (a scheduled script through ops vs. a request-time check); how accounts in a window are found without scanning every account (accounts without a row derive their trial from `auth.users.created_at`).
- **Risk:** LOW.
- **Baseline:** monetization MO-1 `billing-entitlements`: the reminder windows only drive the in-app badge and notice; no mail is sent (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.

### FU-9: Payment requests, revoke and grant history in the billing admin page
- **Change ID:** `billing-admin-requests`
- **Status:** done
- **Input:** [`archive/2026-10-03-billing-admin-requests/`](../archive/2026-10-03-billing-admin-requests/change.md)
- **Outcome:** Invoice requests stored in a billing table and listed in `BillingAdminPage` with a one-click grant; a revoke action; a history of grants per account; optionally a `grant-plan` script; the payment page and the grant form tell a lifetime account apart (today it can still request an invoice, and a dated grant to it is a silent no-op).
- **Prerequisites:** FU-11 on `master` (shared files, see Order; MO-3 may add a payment-events table to share).
- **Unknowns:** One table for manual requests and provider payment events vs. two; retention of invoice details (personal data, privacy contributor).
- **Risk:** LOW.
- **Baseline:** monetization MO-2 `billing-plans-pricing`: requests reach the owner only through `manual({ onRequest })` (the example mails them); the admin grants by email, cannot revoke and sees no history (README §12). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12

### FU-11: Refunds that take back one payment's period
- **Change ID:** `billing-refund-one-payment`
- **Status:** done
- **Input:** [`archive/2026-10-03-billing-refund-one-payment/`](../archive/2026-10-03-billing-refund-one-payment/change.md)
- **Outcome:** A full refund removes only the access the refunded payment granted (its period, or the lifetime it bought), not every paid period of the account; optionally partial refunds handled by a policy.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Storing each payment's granted start and end in `billing.payments`; a shortening entitlement event vs. recomputing access from the remaining payments; how manual grants (no payment row) count.
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-3 `billing-provider-adapter`: `charge.refunded` revokes all paid access (`revoke`), so a refund of one of two stacked months, or of a monthly payment next to a lifetime, takes everything (README §12, plan review W4). After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12; `context/archive/2026-10-03-billing-provider-adapter/reviews/plan-review.md` W4

### FU-12: Retro research and plan review for MO-1 and MO-2
- **Change ID:** `billing-retro-reviews`
- **Status:** done
- **Input:** [`archive/2026-10-04-billing-retro-reviews/change.md`](../archive/2026-10-04-billing-retro-reviews/change.md)
- **Outcome:** `research.md` and `reviews/plan-review.md` written after the fact for `billing-entitlements` (MO-1, plan review skipped) and `billing-plans-pricing` (MO-2, research and plan review skipped); every finding that still applies to the code is fixed or filed as its own FU item.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether findings need code changes in `modules/billing/` (then they become their own items).
- **Risk:** LOW.
- **Baseline:** monetization MO-1 and MO-2 skipped phases of the SOFTURE chain (coordinator, 2026-10-03, after the owner's question); their archives have no research.md or plan-review.md. After: both archives carry the missing documents.
- **PRD refs:** FR-22.
- **Source:** `context/archive/2026-10-03-billing-entitlements/`, `context/archive/2026-10-03-billing-plans-pricing/`

### FU-13: The marketing-kit fixture film renders in CI
- **Change ID:** `marketing-kit-render-ci`
- **Status:** done
- **Input:** [`archive/2026-10-03-marketing-kit-render-ci/change.md`](../archive/2026-10-03-marketing-kit-render-ci/change.md)
- **Outcome:** A CI job (or a step of an existing one) installs a Chromium, sets `PLAYWRIGHT_CHROMIUM_PATH` and `HYPERFRAMES_BROWSER_PATH`, and runs `MARKETING_KIT_RENDER=1` on `tools/marketing-kit/tests/render.test.ts`.
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether the e2e job's Playwright Chromium also serves hyperframes (a headless shell worked locally); the job's run time (about 85 s locally).
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-1 `mk-core-port`: the render test is opt-in and ran locally only (CI's test job has no browser). After: it runs on every push.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/tests/render.test.ts`; `context/archive/2026-10-03-mk-core-port/research.md` (Open questions)

### FU-14: The marketing.json JSON Schema documents every key
- **Change ID:** `marketing-kit-schema-docs`
- **Status:** done_code (2026-10-03; waiting: owner editor check, MK-8 release)
- **Input:** [`archive/2026-10-03-marketing-kit-schema-docs/change.md`](../archive/2026-10-03-marketing-kit-schema-docs/change.md)
- **Outcome:** Every key of `tools/marketing-kit/schema/marketing.schema.json` carries a `description` (from `.describe()` on the zod schema instead of doc comments), so editors and agents writing a `marketing.json` see what each key means and its default.
- **Prerequisites:** none beyond the main branch; best after MK-3…MK-7 have added their keys.
- **Unknowns:** Whether `z.toJSONSchema` keeps descriptions on keys wrapped in `.default()` and `.prefault()`.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-2 `mk-config-contract`: the schema has types, patterns and defaults but no descriptions; the meaning lives in doc comments in `src/config/schema.ts` and the README table. After: a test checks that every property has a description.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/src/config/schema.ts`; `context/archive/2026-10-03-mk-config-contract/reviews/impl-review.md`

### FU-15: A 16:9 film can show the desktop app in a browser frame
- **Change ID:** `marketing-kit-desktop-16x9`
- **Status:** proposed
- **Outcome:** A video can ask for a desktop recording: the recorder opens a desktop viewport (`isMobile: false`), and the 16:9 composition frames it as a browser window instead of a phone, with the same captions, persona and end card.
- **Prerequisites:** FU-16 on `master` (shared files, see Order).
- **Unknowns:** Whether the scene of a phone film can be reused at a desktop viewport or needs its own scene; how camera focus scales map to a wider screen.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-6 `mk-formats`: 16:9 is a framed phone on the left with copy on the right (frame.md, framing 2 deferred). After: a 16:9 desktop film renders from the fixture project.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

### FU-16: A project can adjust a format's layout in marketing.json
- **Change ID:** `marketing-kit-layout-overrides`
- **Status:** done_code (2026-10-03; waiting: MK-8 release)
- **Input:** [`archive/2026-10-03-marketing-kit-layout-overrides/change.md`](../archive/2026-10-03-marketing-kit-layout-overrides/change.md)
- **Outcome:** `marketing.json` can override entries of the per-format geometry table (caption box and font size, persona and end-card position, end-card phone pose), validated by the schema, so a brand with long headlines or another caption style does not need a package change.
- **Prerequisites:** FU-14 on `master` (shared files, see Order).
- **Unknowns:** Which entries are worth exposing; whether overrides are per video or per format.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-6 `mk-formats`: the layout is a fixed table in `src/compose/timeline.ts` (frame.md, framing 3 deferred). After: an override in the fixture config changes the composition snapshot.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

### FU-17: OG images refuse copy the brand fonts cannot draw
- **Change ID:** `marketing-kit-og-glyphs`
- **Status:** done_code (2026-10-03; waiting: MK-8 release)
- **Outcome:** Before laying out an OG card, the renderer checks every character of the template's text against the loaded fonts' character maps and returns an error naming the image, the JSON path and the missing characters (e.g. Polish letters with a `latin` subset file).
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether Satori exposes its parsed fonts or the check needs its own font parser (opentype.js is already a Satori dependency); how emoji should be treated.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-5 `mk-og-images`: Satori draws nothing for a missing glyph and reports no error; the README tells projects to ship fonts that cover their language. After: a test with a `latin` subset font and Polish copy gets the error.
- **PRD refs:** FR-25.
- **Source:** `tools/marketing-kit/src/og/fonts.ts`; `context/archive/2026-10-03-mk-og-images/research.md` (Constraints and risks)

### FU-18: Screenshots at a device scale and in both colour schemes
- **Change ID:** `marketing-kit-screenshot-variants`
- **Status:** done_code (2026-10-04; waiting: MK-8 release)
- **Outcome:** A `screenshots[]` entry can set a device scale (a retina capture for a store listing or a landing page) and capture the light and dark schemes in one run (`<id>-light.png`, `<id>-dark.png`), still behind the status, phrase and size gates.
- **Prerequisites:** FU-14 on `master` (shared files, see Order).
- **Unknowns:** Whether the size gate's 40 kB default should scale with the device scale.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-4 `mk-screenshots`: PNG at Playwright's default scale (1), one scheme per run (`app.colorScheme`). After: the schema takes `scale` and a scheme list, the tests cover both.
- **PRD refs:** FR-25.
- **Source:** `tools/marketing-kit/README.md` "Limitations"; `context/archive/2026-10-03-mk-screenshots/reviews/impl-review.md` F4

### FU-19: Opening shots after the first name their word in the config check
- **Change ID:** `marketing-kit-hook-shot-words`
- **Status:** proposed
- **Outcome:** A `videos[].hook.shots[]` entry after the first without `word` is refused when `marketing.json` loads, on the path `videos[i].hook.shots[j].word`, instead of failing at compose time after the recording with an error that names an empty word.
- **Prerequisites:** FU-14 on `master` (shared files, see Order).
- **Unknowns:** none.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-2 `mk-config-contract`: `word` is optional on every shot (`src/config/schema.ts`), and `src/compose/compose.ts` throws for a later shot without one. After: a config test refuses it, and the schema description says when it is required.
- **PRD refs:** FR-24.
- **Source:** FU-14 (`marketing-kit-schema-docs`) implementation review F2; `tools/marketing-kit/src/compose/compose.ts` (opening shots)

### FU-20: Partial refunds take back access by a policy
- **Change ID:** `billing-partial-refunds`
- **Status:** proposed
- **Outcome:** A partial refund changes access by a documented policy; partial refunds summing to the full amount act like one full refund.
- **Prerequisites:** FU-11 on `master` (payments record their grant); runs in lane C after FU-6 (shared files).
- **Unknowns:** Pro rata by amount vs. a fixed rule; rounding of days; tracking the refunded amount per payment (`charge.amount_refunded`); whether the policy is an option of `billing()`.
- **Risk:** LOW.
- **Baseline:** FU-11 `billing-refund-one-payment`: `charge.refunded` with `refunded: false` is ignored (README §12). After: a partial refund follows the policy, covered by unit tests with signed webhook fixtures.
- **Source:** FU-11 (the optional half of its outcome, deferred in its research); `modules/billing/README.md` §12

### FU-21: A manual lifetime grant survives a refunded paid lifetime
- **Change ID:** `billing-refund-manual-lifetime`
- **Status:** proposed
- **Outcome:** A refunded paid lifetime keeps lifetime access when the admin also granted it by hand.
- **Prerequisites:** FU-9 on `master` (its grant history records manual grants).
- **Unknowns:** Whether FU-9's grant history can be read in the refund's transaction under the entitlement lock; how a manual revoke after a manual lifetime counts.
- **Risk:** LOW.
- **Baseline:** FU-11 `billing-refund-one-payment`: a refunded paid lifetime ends lifetime unless another paid lifetime payment exists; manual grants have no payment row (README §12). After: manual lifetime grants count, covered by unit tests.
- **Source:** FU-11 research ("Answers to unknowns", manual grants); `modules/billing/README.md` §12

### FU-22: A `grant-plan` ops script for hosts without the admin page
- **Change ID:** `billing-grant-plan-script`
- **Status:** proposed
- **Outcome:** `@softure-ai/billing/scripts` exports `grant-plan` and `revoke-grant` ops scripts (dry run by default, `--commit` writes) that grant a plan to an account by email and revoke a manual grant, recorded in the account's history like the admin page's grants.
- **Prerequisites:** FU-9 on `master` (`grantPlanManually`, `revokeManualGrant`).
- **Unknowns:** Whether billing may depend on `@softure-ai/ops` (auth does, for `grant-role`); how the script names a grant to revoke (its id from the history vs. the latest active grant of a plan).
- **Risk:** LOW.
- **Baseline:** FU-9 `billing-admin-requests`: manual grants are recorded only through the admin page or the server API; the roadmap's optional script was left out (README §12). After: the scripts exist, covered by unit tests, and the example ships them next to `grant-role`.
- **Source:** FU-9 research ("Answers to unknowns", 6); `modules/billing/README.md` §12

### FU-23: OG images use every subset file of a weight
- **Change ID:** `marketing-kit-og-subset-fonts`
- **Status:** proposed
- **Outcome:** A brand font listing several files of one weight (e.g. Fontsource `latin` and `latin-ext`, split by `unicodeRange` for the video renderer) draws Polish copy in OG images too: each further file of a weight is registered with Satori so its fallback reaches it, at the requested weight.
- **Prerequisites:** FU-17 on `master`.
- **Unknowns:** Registering further files under derived family names (Satori falls back across families, not files) vs. merging; the order Satori tries them in; whether `unicodeRange` should steer the choice.
- **Risk:** LOW.
- **Baseline:** FU-17 `marketing-kit-og-glyphs`: Satori keeps one file per family, weight and style (the first), so such a brand gets the missing-glyph error; the README says to ship one covering file per weight. After: the `latin` + `latin-ext` brand renders Polish copy, covered by a render test and the glyph check.
- **PRD refs:** FR-25.
- **Source:** FU-17 plan review C1 (`context/archive/2026-10-03-marketing-kit-og-glyphs/reviews/plan-review.md`); `tools/marketing-kit/src/og/fonts.ts`

### FU-24: Existing accounts keep their access when billing is enabled
- **Change ID:** `billing-existing-accounts`
- **Status:** proposed
- **Outcome:** An app that turns billing on (FIRE_TRACKER first) keeps its existing users' access: known trial ends and paid periods are imported into `billing.entitlements`, accounts created before a chosen date can get a trial from that date instead of from their sign-up, derived trials can be pinned before a `trial.days` or time zone change, and the README says what each config change does to accounts without a row.
- **Prerequisites:** FU-22 on `master` (lane C).
- **Unknowns:** An import format (ops script reading rows vs. a server function the app calls); whether the trial floor is an option (`trial.startsAt`) or only part of the import; how imported paid periods and lifetime access are recorded (manual grants vs. raw entitlement rows).
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-1 `billing-entitlements`: a row-less account's trial starts at `auth.users.created_at`, so every account older than `trial.days` is read-only on the first read after billing is enabled; FIRE's `trial_ends_at` / `paid_until` have no import path; a change of `trial.days` or `config.timezone` moves every derived trial (README §5 names only `trial.days`). After: the gap is closed and covered by unit tests on PGlite and an e2e.
- **PRD refs:** FR-22.
- **Source:** FU-12 retro plan review of MO-1, W1 and W2 (`context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md`); `modules/billing/src/server/entitlements.ts`, `modules/billing/README.md` intro and §5

### FU-25: Stripe charges the plan's price in every currency
- **Change ID:** `billing-stripe-currency-units`
- **Status:** proposed
- **Outcome:** The Stripe adapter sends each plan's price in the unit Stripe expects for its currency: special-case currencies (ISK and UGX sent ×100; HUF and TWD amounts divisible by 100, per Stripe's currency guide) are scaled or refused when the config loads, and formatting is tested for a 3-decimal currency (KWD).
- **Prerequisites:** FU-24 on `master` (lane C).
- **Unknowns:** The exact list and rules in Stripe's current currency guide (confirm first; the FU-12 session could not fetch it); scale in the adapter vs. refuse the currency.
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-2 `billing-plans-pricing` and MO-3 `billing-provider-adapter`: prices are minor units by `Intl` (`src/price.ts`), and `stripe()` sends `unit_amount = plan.price.amount` unchanged (`src/stripe.ts`), so an ISK 1,500 plan would be charged ISK 15. After: the gap is closed and covered by unit tests on the Checkout request.
- **PRD refs:** FR-22.
- **Source:** FU-12 retro plan review of MO-2, W1 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`); `modules/billing/src/stripe.ts`, `modules/billing/src/price.ts`

### FU-26: Billing guards and lock races are tested where they can fail
- **Change ID:** `billing-guard-race-tests`
- **Status:** proposed
- **Outcome:** CI proves billing's guards and locks: `requireWriteAccess` and every billing server action are unit-tested as anonymous, member and admin; the first-insert race of `changeEntitlement` and two concurrent plan grants run on two Postgres connections; an e2e covers a paid period that ended; a misspelt `adminRole` (not among `auth({ roles })`) fails at setup instead of silently locking every admin out.
- **Prerequisites:** FU-25 on `master` (lane C).
- **Unknowns:** How a unit test mocks the Next session for `/next` actions (auth's test helpers vs. a module mock); running the two-connection tests against the CI Postgres service vs. the e2e database.
- **Risk:** LOW.
- **Baseline:** monetization MO-1 and MO-2: the guards are correct today but no unit test calls them without a session or role; the race tests run on PGlite, one connection, so they cannot fail (MO-1 impl review #5, MO-2 impl review #1). After: the gap is closed by the tests themselves.
- **PRD refs:** FR-22.
- **Source:** FU-12 retro plan reviews: MO-1 W3, S1, S2; MO-2 W2, W3, S5 (`context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md`, `context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`)

### FU-27: Invoice requests are stored before the owner hears of them and keep only what they need
- **Change ID:** `billing-invoice-request-hygiene`
- **Status:** proposed
- **Outcome:** A manual invoice request is stored before it is handed to the provider (the owner's mail), a refresh of an open request does not mail the owner again, invoice fields are parsed by a zod schema that refuses control characters, a too-long field gets its own message, open requests older than a configurable age are closed with their details cleared, and requests and manual grants record the plan's amount and currency.
- **Prerequisites:** FU-26 on `master` (lane C).
- **Unknowns:** The default age for closing a stale request; whether the price snapshot needs a migration `0005` on both tables (likely) and how existing rows are left (NULL).
- **Risk:** LOW.
- **Baseline:** monetization MO-2 `billing-plans-pricing` and FU-9 `billing-admin-requests`: `startPayment` hands the request over before `recordPaymentRequest` (`src/server/plans.ts`), a refresh mails again, a newline in the name adds lines to the owner's mail, one text says "fill in" for a too-long optional tax ID, an unclosed request keeps personal data forever, and a manual grant records no price. After: the gap is closed and covered by unit and e2e tests.
- **PRD refs:** FR-22.
- **Source:** FU-12 retro plan review of MO-2, S1-S4 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`); `modules/billing/src/server/plans.ts`, `src/fields.ts`, `migrations/0004_create_requests_and_grants.sql`

### FU-28: A signed-in visitor's redirect from a tagged login page keeps the tag
- **Change ID:** `auth-page-redirect-tag`
- **Status:** proposed
- **Outcome:** Auth's login and register pages redirect a signed-in visitor to a URL that keeps the page's own channel tag (for example `rewriteRedirect` given the page's search parameters, or a page-level counterpart of `tagRedirect` that reads them instead of `Referer`).
- **Prerequisites:** FU-7 on `master` (shared files, see Order).
- **Unknowns:** Whether `rewriteRedirect` can read the page's own URL in a render (it reads `Referer` today); whether the case matters enough beyond the account page's beacon.
- **Risk:** LOW. Only a signed-in visitor opening a tagged login link with a full page load; the account view lands under no channel.
- **Baseline:** FU-7 `analytics-action-redirect-tag`: actions keep the tag through `rewriteRedirect`; the pages' `redirect(next)` in `modules/auth/src/next/pages.tsx` does not use it, and the follow-up request's `Referer` is the page before the tagged one (analytics README §12). After: the page redirect keeps the tag, covered by e2e.
- **PRD refs:** FR-23.
- **Source:** FU-7 research ("Open questions"); `modules/analytics/README.md` §12

## Owner decisions and checks

Carried over from marketing-kit (owner, batch at the keyboard on Monday 2026-10-05):

- [ ] **EN-9**: approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on npmjs.com, then
  add a trusted publisher for each.
- [ ] **MO-6**: approve the first (staged) publish of billing and analytics on npmjs.com, then add a trusted
  publisher for each.
- [ ] **MK-8**: approve the first (staged) publish of `@softure-ai/marketing-kit` on npmjs.com, then add its trusted
  publisher.

Open from FU-14:

- [ ] **FU-14**: Owner reads a few descriptions in an editor hover and finds them clear (Manual 1.6). archive/2026-10-03-marketing-kit-schema-docs/plan.md

## Done

- **FU-8** `waitlist-funnel-hook`: `waitlist({ onJoined })` runs in the sign-up's transaction when a sign-up first counts; analytics' `countFunnelStep` counts it under its channel, kept through double opt-in by `rewriteConfirmationLink`; covered by unit and e2e tests; archived in `archive/2026-10-04-waitlist-funnel-hook/`
- **FU-7** `analytics-action-redirect-tag`: auth's action redirects keep the channel tag through `rewriteRedirect` and analytics' `tagRedirect`, with and without JavaScript, covered by unit and e2e tests; archived in `archive/2026-10-03-analytics-action-redirect-tag/`
- **FU-16** `marketing-kit-layout-overrides`: `marketing.json` `layout` overrides a format's caption box and size, persona card, end card and its phone pose, validated against the frame; archived in `archive/2026-10-03-marketing-kit-layout-overrides/`
- **FU-4** `waitlist-welcome-html`: both waitlist mails carry an HTML body built from their copy (the confirmation link as an anchor); `waitlist({ mailTemplate })` renders it in the app's layout; archived in `archive/2026-10-03-waitlist-welcome-html/`
- **FU-5** `analytics-client-navigation`: `<ChannelKeeper />` keeps the channel tag on client navigations without `Next-Url`, covered by unit and e2e tests; archived in `archive/2026-10-03-analytics-client-navigation/`
- **FU-1** `switch-reader-contract`: auth reads `auth.registration_closed` through the switch-reader contract in core, provided by feature-switches; the panel flips it and reports undefined manifest switches; archived in `archive/2026-10-03-switch-reader-contract/`
- **FU-14** `marketing-kit-schema-docs`: every key of the marketing.json JSON Schema carries a description, guarded by a test; archived in `archive/2026-10-03-marketing-kit-schema-docs/`
- **FU-17** `marketing-kit-og-glyphs`: OG images refuse copy no font Satori would try can draw, naming the image, the JSON path and the characters; archived in `archive/2026-10-03-marketing-kit-og-glyphs/`
- **FU-2** `waitlist-double-opt-in`: `waitlist({ doubleOptIn })`, a single-use confirmation link (transactional mail) before consents, the opt-out lift and list mail; expiry 7 days by default, `pruneUnconfirmedSignups`; archived in `archive/2026-10-03-waitlist-double-opt-in/`
- **FU-3** `mailing-consent-sync`: an unsubscribe withdraws the waitlist's consents in its transaction (mailing `onUnsubscribed`), and a new sign-up lifts the person's own opt-out; archived in `archive/2026-10-03-mailing-consent-sync/`
- **FU-13** `marketing-kit-render-ci`: a `render` job in ci.yml records, composes and renders the fixture film on hyperframes' own headless shell on every push; archived in `archive/2026-10-03-marketing-kit-render-ci/`
- **FU-11** `billing-refund-one-payment`: a full refund takes back only what its payment granted (one period's unused days, or one lifetime); archived in `archive/2026-10-03-billing-refund-one-payment/`
- **FU-9** `billing-admin-requests`: the billing admin page lists stored invoice requests (grant or dismiss), records and revokes manual grants one by one and shows an account's history; a lifetime account cannot pay or be granted again; archived in `archive/2026-10-03-billing-admin-requests/`

## Decisions (auto)

- The loose follow-up files become this roadmap's entries. → The owner wants every gap in one catch-all roadmap
  at the end (2026-10-03); `identity-followups.md` keeps its entry ticked with a pointer.
- Waitlist placement analytics is not an item here. → It belongs to MO-5 (`analytics-funnel`) of monetization.
- FU-10 (`billing-stripe-sandbox-e2e`) moved to [`roadmap-later`](roadmaps/roadmap-later.md) as LT-1 (owner, 2026-10-03). →
  It waits only on the owner's Stripe secrets (set on 2026-10-05), not on the end of every roadmap. The number
  FU-10 is not reused.
- Promoted last, with MK-8, EN-9 and MO-6 carried over as blocked owner items (owner, 2026-10-03). → The batch
  release at the keyboard on 2026-10-05 must not hold back the followups.
- Every FU item is autonomous (assessment 2026-10-03, "Owner at the keyboard?"). → None needs a secret, an account,
  a paid call, the owner's machine or a product decision; the Stripe sandbox e2e that does is LT-1 in `roadmap-later`.
- Items that share a module or `schema.ts` run in one lane, one after another. → Parallel threads on the same files
  would conflict on every merge; lanes keep the parallel set disjoint.
