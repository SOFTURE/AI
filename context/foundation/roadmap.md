---
project: "SOFTURE AI"
roadmap: followups
version: 1
status: ready
prd_version: 1
created: 2026-10-03
updated: 2026-10-03
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
| **FU-1** | `switch-reader-contract` | Switch-reader contract in core | — | autonomous | proposed |
| **FU-2** | `waitlist-double-opt-in` | Waitlist double opt-in | FU-3 | autonomous | proposed |
| **FU-3** | `mailing-consent-sync` | Unsubscribe as consent withdrawal | — | autonomous | done |
| **FU-4** | `waitlist-welcome-html` | HTML welcome mail for the waitlist | FU-2 | autonomous | proposed |
| **FU-5** | `analytics-client-navigation` | Channel tag on client navigations without Next-Url | — | autonomous | done_code (2026-10-03; waiting: MO-6 release of `@softure-ai/analytics`) |
| **FU-6** | `billing-reminder-mail` | Reminder mail before access ends | FU-9 | autonomous | proposed |
| **FU-7** | `analytics-action-redirect-tag` | Channel tag kept through server action redirects | FU-1, FU-5 | autonomous | proposed |
| **FU-8** | `waitlist-funnel-hook` | Waitlist sign-ups as a funnel step | FU-4 | autonomous | proposed |
| **FU-9** | `billing-admin-requests` | Payment requests, revoke and grant history in the billing admin page | FU-11 | autonomous | proposed |
| **FU-11** | `billing-refund-one-payment` | Refunds that take back one payment's period | — | autonomous | proposed |
| **FU-12** | `billing-retro-reviews` | Retro research and plan review for MO-1 and MO-2 | — | autonomous | proposed |
| **FU-13** | `marketing-kit-render-ci` | the marketing-kit fixture film renders to a draft MP4 on every push | — | autonomous | proposed |
| **FU-14** | `marketing-kit-schema-docs` | every key of the marketing.json JSON Schema carries a description | — | autonomous | done_code (2026-10-03; waiting: owner editor check, MK-8 release) |
| **FU-15** | `marketing-kit-desktop-16x9` | desktop 16:9 films recorded in a browser frame instead of a phone | FU-16 | autonomous | proposed |
| **FU-16** | `marketing-kit-layout-overrides` | per-format layout overrides (caption box, persona, end card) in marketing.json | FU-14 | autonomous | proposed |
| **FU-17** | `marketing-kit-og-glyphs` | OG images refuse copy the brand fonts cannot draw | — | autonomous | proposed |
| **FU-18** | `marketing-kit-screenshot-variants` | screenshots at a device scale and in both colour schemes | FU-14 | autonomous | proposed |
| **FU-19** | `marketing-kit-hook-shot-words` | opening shots after the first without a `word` are refused when the config loads | FU-14 | autonomous | proposed |

## Order

Lanes follow file ownership: items in one lane share files (a module, its migrations, `schema.ts`), so they run one
after another; different lanes run in parallel, up to 4 at once.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: switches | FU-1 | `foundation/core/`, `modules/auth/`, `modules/feature-switches/` |
| B: waitlist and consent | FU-3 → FU-2 → FU-4 → FU-8 | `modules/waitlist/` (FU-3 also `modules/mailing/`, `modules/privacy/`) |
| C: billing | FU-11 → FU-9 → FU-6; FU-12 any time | `modules/billing/` and its migrations; FU-12 writes archive documents only |
| D: analytics | FU-5 → FU-7 (FU-7 also after FU-1) | `modules/analytics/` channel propagation; FU-7 may touch auth's redirects |
| E: marketing-kit config | FU-14 → FU-16 → FU-15; FU-14 → FU-18 → FU-19 | `tools/marketing-kit/src/config/schema.ts`, `schema/`, `src/compose/` (FU-15, FU-16) |
| F: independent | FU-13, FU-17 | `.github/workflows/ci.yml`; `tools/marketing-kit/src/og/` |

1. **First wave: FU-1, FU-3, FU-11, FU-14.** The two HIGH items first (FU-1 must land before FIRE_TRACKER
   adopts the switches; FU-3 fixes a consent ledger that can contradict an unsubscribe), then the MEDIUM refund
   fix and the schema descriptions that every later marketing-kit config item extends.
2. **Each free slot** takes the first item of this list whose lane is idle and whose dependencies are on `master`:
   FU-2, FU-5, FU-13, FU-17, FU-9, FU-16, FU-18, FU-4, FU-7, FU-12, FU-6, FU-15, FU-8, FU-19.
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
- **Status:** proposed
- **Outcome:** A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).
- **Prerequisites:** FU-1, FU-5 on `master` (shared files, see Order).
- **Unknowns:** Whether a redirect helper in analytics can wrap auth's actions without auth depending on analytics; how Next renders the redirect target in the action's own response (the proxy never sees a GET for it).
- **Risk:** LOW. The counts after sign-up land under no channel; the sign-up step itself is attributed.
- **Baseline:** monetization MO-5 `analytics-funnel`: after the register action, the account page opens at `/account` without `?z=`, so its beacon counts without a channel (`examples/next-app/e2e/analytics-funnel.spec.ts`). After: the tag survives the redirect, covered by e2e.
- **PRD refs:** FR-23.
- **Source:** MO-5, `examples/next-app/e2e/analytics-funnel.spec.ts` (the account view after sign-up) and `modules/analytics/README.md` §12

### FU-8: Waitlist sign-ups as a funnel step
- **Change ID:** `waitlist-funnel-hook`
- **Status:** proposed
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
- **Status:** proposed
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
- **Status:** proposed
- **Outcome:** Invoice requests stored in a billing table and listed in `BillingAdminPage` with a one-click grant; a revoke action; a history of grants per account; optionally a `grant-plan` script; the payment page and the grant form tell a lifetime account apart (today it can still request an invoice, and a dated grant to it is a silent no-op).
- **Prerequisites:** FU-11 on `master` (shared files, see Order; MO-3 may add a payment-events table to share).
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
- **Status:** proposed
- **Outcome:** `marketing.json` can override entries of the per-format geometry table (caption box and font size, persona and end-card position, end-card phone pose), validated by the schema, so a brand with long headlines or another caption style does not need a package change.
- **Prerequisites:** FU-14 on `master` (shared files, see Order).
- **Unknowns:** Which entries are worth exposing; whether overrides are per video or per format.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-6 `mk-formats`: the layout is a fixed table in `src/compose/timeline.ts` (frame.md, framing 3 deferred). After: an override in the fixture config changes the composition snapshot.
- **PRD refs:** FR-24.
- **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

### FU-17: OG images refuse copy the brand fonts cannot draw
- **Change ID:** `marketing-kit-og-glyphs`
- **Status:** proposed
- **Outcome:** Before laying out an OG card, the renderer checks every character of the template's text against the loaded fonts' character maps and returns an error naming the image, the JSON path and the missing characters (e.g. Polish letters with a `latin` subset file).
- **Prerequisites:** none beyond the main branch.
- **Unknowns:** Whether Satori exposes its parsed fonts or the check needs its own font parser (opentype.js is already a Satori dependency); how emoji should be treated.
- **Risk:** LOW.
- **Baseline:** marketing-kit MK-5 `mk-og-images`: Satori draws nothing for a missing glyph and reports no error; the README tells projects to ship fonts that cover their language. After: a test with a `latin` subset font and Polish copy gets the error.
- **PRD refs:** FR-25.
- **Source:** `tools/marketing-kit/src/og/fonts.ts`; `context/archive/2026-10-03-mk-og-images/research.md` (Constraints and risks)

### FU-18: Screenshots at a device scale and in both colour schemes
- **Change ID:** `marketing-kit-screenshot-variants`
- **Status:** proposed
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

- **FU-5** `analytics-client-navigation`: `<ChannelKeeper />` keeps the channel tag on client navigations without `Next-Url`, covered by unit and e2e tests; archived in `archive/2026-10-03-analytics-client-navigation/`
- **FU-14** `marketing-kit-schema-docs`: every key of the marketing.json JSON Schema carries a description, guarded by a test; archived in `archive/2026-10-03-marketing-kit-schema-docs/`
- **FU-3** `mailing-consent-sync`: an unsubscribe withdraws the waitlist's consents in its transaction (mailing `onUnsubscribed`), and a new sign-up lifts the person's own opt-out; archived in `archive/2026-10-03-mailing-consent-sync/`

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
