---
project: "SOFTURE AI"
roadmap: later
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-10-06
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
> Carried over (2026-10-04): the blog roadmap closed (archived in
> [`../archive/2026-10-04-2-roadmap.md`](../archive/2026-10-04-2-roadmap.md)) with BL-8, the first npm publish of
> `@softure-ai/seo` and `@softure-ai/blog`, waiting on the owner at the keyboard. It moved here with its ID, and no
> main roadmap was promoted in blog's place.
>
> Carried over (2026-10-06): the deploy roadmap closed (archived in
> [`../archive/2026-10-06-roadmap.md`](../archive/2026-10-06-roadmap.md)) with DP-8, the first npm publish of
> `@softure-ai/deploy` and `@softure-ai/testing` and the `deploy-workflows-v1` tag, waiting on the owner at the
> keyboard. It moved here with its ID, and no main roadmap was promoted in deploy's place.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
> - Owner at the keyboard: every item but LT-2 (MK-8, EN-9, MO-6, BL-8 and DP-8 the first npm publishes; DP-8 also
>   the workflow tag).

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **EN-9** | `engagement-release` | mailing, waitlist, mcp-access and privacy 0.1.0 published through the release pipeline; READMEs and docs updated | EN-1…EN-8 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |
| **MO-6** | `monetization-release` | billing and analytics 0.1.0 published through the release pipeline; READMEs and docs updated | MO-1…MO-5 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |
| **MK-8** | `marketing-kit-release` | `@softure-ai/marketing-kit` 0.1.0 published through the release pipeline, README complete | MK-1…MK-7 (done) | owner | blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05) |
| **BL-8** | `blog-release` | `@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the release pipeline; READMEs, adoption guides and docs updated | BL-1…BL-7 (done) | owner | blocked (carried over from blog: the owner's first npm publish at the keyboard) |
| **DP-8** | `deploy-release` | `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the release pipeline; the deploy workflows tagged for callers | DP-1…DP-7 (done) | owner | blocked (carried over from deploy: the owner's first npm publish and the workflow tag at the keyboard) |
| **LT-2** | `release-version-inline-manifest` | `release:version` keeps a module's inline manifest in step with `module.json` | — | autonomous | ready |

## Order

1. **MK-8, EN-9 and MO-6**: the owner's batch release at the keyboard (Monday 2026-10-05). They wait for no other
   item.
2. **BL-8**: the first publish of `@softure-ai/seo` and `@softure-ai/blog`, at the keyboard. It waits for no other
   item; the owner can take it in the same batch as MK-8, EN-9 and MO-6.
3. **DP-8**: the first publish of `@softure-ai/deploy` and `@softure-ai/testing` and the `deploy-workflows-v1` tag,
   at the keyboard. It waits for no other item.
4. **LT-2** any time; it must land before the next bump of a module after 0.1.0.

## Items

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

### BL-8: SEO and blog release (carried over)
- **Change ID:** `blog-release`
- **Status:** blocked (carried over from blog: the owner's first npm publish at the keyboard)
- **Outcome:** `@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); module READMEs with an adoption guide for FIRE_TRACKER (its blog plugins: engine chart, facts rules, calculator scenario); a finish review across BL-1…BL-7.
- **Prerequisites:** BL-1…BL-7 (done, see [`archive/2026-10-04-2-roadmap.md`](../archive/2026-10-04-2-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, FR-26, G-4.

### DP-8: Deploy and testing release (carried over)
- **Change ID:** `deploy-release`
- **Status:** blocked (carried over from deploy: the owner's first npm publish and the workflow tag at the keyboard)
- **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2, `deploy-workflows-v1`) set by the owner; READMEs with an adoption guide for FIRE_TRACKER. `tools/deploy/package.json` and `foundation/testing/package.json` carry `"private": true` until then, so an `auto-release` of `all` cannot publish them early; DP-8 removes it.
- **Prerequisites:** DP-1…DP-7 (done, see [`archive/2026-10-06-roadmap.md`](../archive/2026-10-06-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases; callers pin `deploy-workflows-v1`.
- **PRD refs:** FR-2, FR-26, G-4.

### LT-2: release:version keeps inline manifests in step
- **Change ID:** `release-version-inline-manifest`
- **Status:** ready
- **Outcome:** `release:version` updates (or makes redundant) the inline manifest version of a module, so the bumped module's "ships a module.json equal to its manifest" test and the release gates stay green.
- **Prerequisites:** none.
- **Unknowns:** whether the inline manifest should import `module.json` instead of repeating it.
- **Risk:** low.
- **Baseline:** `scripts/release/version.mjs` writes `package.json`, the lockfile and `module.json` only; each module repeats `version` in `src/index.ts`, and its `tests/module.test.ts` compares the two. After: a bump leaves them equal.
- **Source:** `packages-first-release` research (2026-10-05).

## Before the next release

Carried over from blog with BL-8:

- [ ] `@softure-ai/seo` and `@softure-ai/blog` enter the release pipeline's package list (**BL-8**).

## Owner decisions and checks

- [ ] **First batch release**: all 16 packages are at 0.1.2 on `master` (`packages-first-release`, then
  `release-0-1-1` and `release-stage-tarball-path`: the 0.1.0 and 0.1.1 runs failed before publishing anything); the agent runs
  `auto-release.yml` with `all` on the owner's word (`release-dispatch`), then the owner approves each staged version and
  adds its trusted publisher. This covers BL-8, MK-8, EN-9 and MO-6, plus core, db, ui, auth, ops, security and
  feature-switches, which they depend on. The trusted publishers are in place (the owner, 2026-10-06); 0.1.3
  (`release-0-1-3`) stages through them without `NPM_TOKEN`, and the owner approves 0.1.2 and 0.1.3 on npmjs.com.

- [x] **LT-1**: add the Stripe test-mode secret `STRIPE_SECRET_KEY` to the repository (the owner, 2026-10-05).
  `STRIPE_WEBHOOK_SECRET` is not needed: the CI job signs with its own `stripe listen` secret.

Carried over from followups with their items (owner, batch at the keyboard on Monday 2026-10-05):

- [ ] **EN-9**: approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on npmjs.com, then
  add a trusted publisher for each.
- [ ] **MO-6**: approve the first (staged) publish of billing and analytics on npmjs.com, then add a trusted
  publisher for each.
- [ ] **MK-8**: approve the first (staged) publish of `@softure-ai/marketing-kit` on npmjs.com, then add its trusted
  publisher.
- [ ] **FU-14** (open from followups, done in `archive/2026-10-03-marketing-kit-schema-docs/`): read a few
  marketing.json descriptions in an editor hover and find them clear (Manual 1.6).

Carried over from blog with its item:

- [ ] **BL-8**: approve the first (staged) publish of `@softure-ai/seo` and `@softure-ai/blog` on npmjs.com, then add
  a trusted publisher for each.

Carried over from deploy with its item:

- [ ] **DP-8**: approve the first (staged) publish of `@softure-ai/deploy` and `@softure-ai/testing` on npmjs.com,
  add a trusted publisher for each, and set the workflow tag callers use (DP-2: `deploy-workflows-v1`, moved to
  each new workflow release once `@softure-ai/deploy` is on npm).
- [ ] The SSH gateway (`gateway.sh`, forced command) and the Cloudflare-only firewall from FIRE_TRACKER `docker/prod/`
  and `docker/server/`: add them to `softure.vps_foundation` (outside this repository) when convenient.

## Done

- **LT-1** `billing-stripe-sandbox-e2e` (2026-10-05): a payment in Stripe's sandbox whose webhook Stripe delivers
  through `stripe listen`, in the `stripe-sandbox` job of the e2e workflow
  ([`archive/2026-10-05-billing-stripe-sandbox-e2e/`](../../archive/2026-10-05-billing-stripe-sandbox-e2e/change.md)).

## Decisions (auto)

- LT-2 added from `packages-first-release` (2026-10-05). → The next bump of any module after 0.1.0 needs it;
  it waits on nothing, so it is `ready`.

- FU-10 moved here from followups as LT-1 (owner, 2026-10-03). → It waits only on the owner's Stripe secrets, so it
  can run as soon as they are set instead of after every module roadmap.
- MK-8, EN-9 and MO-6 moved here when followups closed, keeping their IDs (2026-10-04). → They wait only on the
  owner at the keyboard, which is what this roadmap holds, and the owner's batch release on 2026-10-05 knows them by
  these IDs; renumbering them as `LT-` would break that link.
- BL-8 moved here when blog closed, keeping its ID (2026-10-04). → Same reason as MK-8, EN-9 and MO-6: it waits only
  on the owner's first npm publish at the keyboard.
- DP-8 moved here when deploy closed, keeping its ID (2026-10-06). → Same reason as BL-8: it waits only on the
  owner's first npm publish and the workflow tag at the keyboard.
