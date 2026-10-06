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
> - Owner at the keyboard: DP-8 (the workflow tag). MK-8, EN-9, MO-6 and BL-8 are done: the release pipeline
>   publishes to npm directly since 0.1.5 (owner, 2026-10-06).

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DP-8** | `deploy-release` | `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the release pipeline; the deploy workflows tagged for callers | DP-1…DP-7 (done) | owner | blocked (both packages staged at 0.1.0 with `release-0-1-4`, trusted publishers added; 0.1.1 publishes them directly with `release-0-1-5`; waits on the owner's workflow tag) |
| **LT-2** | `release-version-inline-manifest` | `release:version` keeps a module's inline manifest in step with `module.json` | — | autonomous | ready |
| **LT-3** | `testing-browser-hook-timeout` | the browser tests of `@softure-ai/testing` launch Chromium within a hook timeout that holds on a loaded runner | — | autonomous | ready |

## Order

1. **DP-8**: the `deploy-workflows-v1` tag, at the keyboard. It waits for no other item.
2. **LT-2** any time; it must land before the next bump of a module done with `release:version`.
3. **LT-3** any time.

## Items

### DP-8: Deploy and testing release (carried over)
- **Change ID:** `deploy-release`
- **Status:** blocked (both packages staged at 0.1.0 with `release-0-1-4`, trusted publishers added; 0.1.1 publishes them directly with `release-0-1-5`; waits on the owner's workflow tag)
- **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2, `deploy-workflows-v1`) set by the owner; READMEs with an adoption guide for FIRE_TRACKER. `tools/deploy/package.json` and `foundation/testing/package.json` carried `"private": true` until then, so an `auto-release` of `all` could not publish them early; `release-0-1-4` removed it (2026-10-06).
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


### LT-3: Testing package browser hook timeout
- **Change ID:** `testing-browser-hook-timeout`
- **Status:** ready
- **Outcome:** `foundation/testing/tests/playwright-browser.test.ts` starts its server and Chromium within a hook timeout sized for a loaded runner (measured, with the measurement in a comment), so the release gates do not fail on a slow browser start.
- **Prerequisites:** none.
- **Unknowns:** whether the hook or the browser launch is the slow part.
- **Risk:** low.
- **Baseline:** the `testing@0.1.1` release (run 37444519206, 2026-10-06) failed its gates once with "Hook timed out in 10000ms" at `playwright-browser.test.ts:91` (Vitest's default `hookTimeout`; `vitest.config.mts` raises only `testTimeout`) and passed on one re-run. After: the hook has a measured timeout.
- **Source:** `release-0-1-5` (2026-10-06).
## Owner decisions and checks

- [x] **First batch release**: all 16 packages are at 0.1.2 on `master` (`packages-first-release`, then
  `release-0-1-1` and `release-stage-tarball-path`: the 0.1.0 and 0.1.1 runs failed before publishing anything); the agent runs
  `auto-release.yml` with `all` on the owner's word (`release-dispatch`), then the owner approves each staged version and
  adds its trusted publisher. This covers BL-8, MK-8, EN-9 and MO-6, plus core, db, ui, auth, ops, security and
  feature-switches, which they depend on. The trusted publishers are in place (the owner, 2026-10-06). 0.1.3
  (`release-0-1-3`) failed at the stage with E401 (nothing published); after the owner corrected the publisher fields,
  0.1.4 (`release-0-1-4`) staged through them without `NPM_TOKEN`. From 0.1.5 (`release-0-1-5`) the pipeline
  publishes directly, live at once without approval (the owner, 2026-10-06): all 18 packages are on npm (16 at 0.1.5,
  deploy and testing at 0.1.1), checked in the registry on 2026-10-06.

- [x] **LT-1**: add the Stripe test-mode secret `STRIPE_SECRET_KEY` to the repository (the owner, 2026-10-05).
  `STRIPE_WEBHOOK_SECRET` is not needed: the CI job signs with its own `stripe listen` secret.

Carried over from followups with their items (owner, batch at the keyboard on Monday 2026-10-05):

- [x] **EN-9** (2026-10-06, published directly at 0.1.5 instead): approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on npmjs.com, then
  add a trusted publisher for each.
- [x] **MO-6** (2026-10-06, published directly at 0.1.5 instead): approve the first (staged) publish of billing and analytics on npmjs.com, then add a trusted
  publisher for each.
- [x] **MK-8** (2026-10-06, published directly at 0.1.5 instead): approve the first (staged) publish of `@softure-ai/marketing-kit` on npmjs.com, then add its trusted
  publisher.
- [ ] **FU-14** (open from followups, done in `archive/2026-10-03-marketing-kit-schema-docs/`): read a few
  marketing.json descriptions in an editor hover and find them clear (Manual 1.6).

Carried over from blog with its item:

- [x] **BL-8** (2026-10-06, published directly at 0.1.5 instead): approve the first (staged) publish of `@softure-ai/seo` and `@softure-ai/blog` on npmjs.com, then add
  a trusted publisher for each.

Carried over from deploy with its item:

- [ ] **DP-8**: both packages are on npm at 0.1.1 with their trusted publishers (2026-10-06); left: set the workflow tag callers use (DP-2: `deploy-workflows-v1`, moved to
  each new workflow release once `@softure-ai/deploy` is on npm).
- [ ] The SSH gateway (`gateway.sh`, forced command) and the Cloudflare-only firewall from FIRE_TRACKER `docker/prod/`
  and `docker/server/`: add them to `softure.vps_foundation` (outside this repository) when convenient.

## Done

- **LT-1** `billing-stripe-sandbox-e2e` (2026-10-05): a payment in Stripe's sandbox whose webhook Stripe delivers
  through `stripe listen`, in the `stripe-sandbox` job of the e2e workflow
  ([`archive/2026-10-05-billing-stripe-sandbox-e2e/`](../../archive/2026-10-05-billing-stripe-sandbox-e2e/change.md)).
- **EN-9** `engagement-release` (2026-10-06): mailing, waitlist, mcp-access and privacy live on npm at 0.1.5
  ([`archive/2026-10-02-engagement-release/`](../../archive/2026-10-02-engagement-release/change.md)).
- **MO-6** `monetization-release` (2026-10-06): billing and analytics live on npm at 0.1.5
  ([`archive/2026-10-02-monetization-release/`](../../archive/2026-10-02-monetization-release/change.md)).
- **MK-8** `marketing-kit-release` (2026-10-06): `@softure-ai/marketing-kit` live on npm at 0.1.5
  ([`archive/2026-10-02-marketing-kit-release/`](../../archive/2026-10-02-marketing-kit-release/change.md)).
- **BL-8** `blog-release` (2026-10-06): `@softure-ai/seo` and `@softure-ai/blog` live on npm at 0.1.5
  ([`archive/2026-10-04-blog-release/`](../../archive/2026-10-04-blog-release/change.md)).

## Decisions (auto)

- LT-3 added from `release-0-1-5` (2026-10-06). → A gap found in the release, filed here instead of fixed on the
  spot (owner, 2026-10-03); it waits on nothing, so it is `ready`.
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
