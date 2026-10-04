---
project: "SOFTURE AI"
roadmap: later
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-10-04
backlog: context/backlog/roadmap-later/
trigger: "the owner step each item waits on (secrets, accounts) is done; the owner promotes it or takes single items"
---

# Roadmap later: items parked until an owner step is done

> Entries: [`context/backlog/roadmap-later/`](../../backlog/roadmap-later/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote later`) or moves a
> single item into the main roadmap.
>
> Parked work (owner, 2026-10-03): an item that is ready to build but waits only on something the owner does at the
> keyboard (repository secrets, a provider account) lands here instead of holding a module roadmap or waiting for
> the followups roadmap at the very end. Each item says in **Prerequisites** what it waits on. A new item gets the
> next `LT-` number, a backlog entry and a row.
>
> Carried over (2026-10-04): the followups roadmap closed (archived in
> [`../archive/2026-10-04-roadmap.md`](../archive/2026-10-04-roadmap.md)) with MK-8, EN-9 and MO-6 still waiting on
> the owner's batch release at the keyboard (Monday 2026-10-05). They moved here with their IDs, since they wait only
> on the owner, and no main roadmap was promoted in followups' place.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
> - Owner at the keyboard: every item (LT-1 the Stripe secrets; MK-8, EN-9 and MO-6 the first npm publishes).

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **LT-1** | `billing-stripe-sandbox-e2e` | Stripe sandbox payment end to end (was FU-10) | the owner's Stripe secrets | owner | blocked (the owner's Stripe test-mode secrets, set on 2026-10-05) |
| **EN-9** | `engagement-release` | mailing, waitlist, mcp-access and privacy 0.1.0 published through the release pipeline; READMEs and docs updated | EN-1…EN-8 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |
| **MO-6** | `monetization-release` | billing and analytics 0.1.0 published through the release pipeline; READMEs and docs updated | MO-1…MO-5 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |
| **MK-8** | `marketing-kit-release` | `@softure-ai/marketing-kit` 0.1.0 published through the release pipeline, README complete | MK-1…MK-7 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |

## Order

1. **LT-1** once the owner has set the Stripe test-mode secrets (planned for Monday 2026-10-05).
2. **MK-8, EN-9 and MO-6**: the owner's batch release at the keyboard (Monday 2026-10-05). They wait for no other
   item, and LT-1 does not wait for them.

## Items

### LT-1: Stripe sandbox payment end to end
- **Change ID:** `billing-stripe-sandbox-e2e`
- **Status:** blocked (the owner's Stripe test-mode secrets, set on 2026-10-05)
- **Outcome:** A browser payment on Stripe's sandbox Checkout (test card) whose webhook reaches the app (Stripe CLI forwarding or a reachable preview) and turns the trial into paid, run in CI when the Stripe test secrets are set.
- **Prerequisites:** the owner's Stripe test-mode secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) in the repository; the Stripe CLI or a public URL for the e2e server.
- **Unknowns:** How the webhook reaches a CI run (`stripe listen` in the job vs. a deployed preview); how stable Stripe's hosted page is for Playwright.
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-3 `billing-provider-adapter`: the Checkout API is tested against the sandbox (`modules/billing/tests/stripe-sandbox.test.ts`, only with the key) and the webhook with signed fixtures (`e2e/billing-stripe.spec.ts`); no test pays in the sandbox and receives Stripe's own delivery (README §12). After: the gap is closed and covered by an e2e test.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12; moved from followups FU-10 on 2026-10-03

### EN-9: Engagement modules release (carried over)
- **Change ID:** `engagement-release`
- **Status:** blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/mailing`, `@softure-ai/waitlist`, `@softure-ai/mcp-access` and `@softure-ai/privacy` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across EN-1…EN-8.
- **Prerequisites:** EN-1…EN-8 (done, see [`archive/2026-10-03-2-roadmap.md`](../archive/2026-10-03-2-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MO-6: Monetization modules release (carried over)
- **Change ID:** `monetization-release`
- **Status:** blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across MO-1…MO-5.
- **Prerequisites:** MO-1…MO-5 (done, see [`archive/2026-10-03-3-roadmap.md`](../archive/2026-10-03-3-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MK-8: marketing-kit release (carried over)
- **Change ID:** `marketing-kit-release`
- **Status:** blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:**
  - `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
  - The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
  - An example `marketing.json` and brand ship in `examples/`.
- **Prerequisites:** MK-1…MK-7 (done, see [`archive/2026-10-03-4-roadmap.md`](../archive/2026-10-03-4-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** package absent from npm. After: `npx @softure-ai/marketing-kit --help` works from npm and from the GitHub Release tarball.
- **PRD refs:** FR-24, FR-25, FR-2.

## Owner decisions and checks

- [ ] **LT-1**: add the Stripe test-mode secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the repository
  (the owner, Monday 2026-10-05).

Carried over from followups with their items (owner, batch at the keyboard on Monday 2026-10-05):

- [ ] **EN-9**: approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on npmjs.com, then
  add a trusted publisher for each.
- [ ] **MO-6**: approve the first (staged) publish of billing and analytics on npmjs.com, then add a trusted
  publisher for each.
- [ ] **MK-8**: approve the first (staged) publish of `@softure-ai/marketing-kit` on npmjs.com, then add its trusted
  publisher.
- [ ] **FU-14** (open from followups, done in `archive/2026-10-03-marketing-kit-schema-docs/`): read a few
  marketing.json descriptions in an editor hover and find them clear (Manual 1.6).

## Done

(nothing yet)

## Decisions (auto)

- FU-10 moved here from followups as LT-1 (owner, 2026-10-03). → It waits only on the owner's Stripe secrets, so it
  can run as soon as they are set instead of after every module roadmap.
- MK-8, EN-9 and MO-6 moved here when followups closed, keeping their IDs (2026-10-04). → They wait only on the
  owner at the keyboard, which is what this roadmap holds, and the owner's batch release on 2026-10-05 knows them by
  these IDs; renumbering them as `LT-` would break that link.
