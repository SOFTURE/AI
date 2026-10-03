---
project: "SOFTURE AI"
roadmap: followups
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-10-03
backlog: context/backlog/roadmap-followups/
trigger: "every module roadmap (monetization, marketing-kit) is done; the owner promotes it last"
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

## Owner decisions and checks

(nothing yet)

## Done

(nothing yet)

## Decisions (auto)

- The loose follow-up files become this roadmap's entries. → The owner wants every gap in one catch-all roadmap
  at the end (2026-10-03); `identity-followups.md` keeps its entry ticked with a pointer.
- Waitlist placement analytics is not an item here. → It belongs to MO-5 (`analytics-funnel`) of monetization.
