---
project: "SOFTURE AI"
roadmap: later
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-11-04
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
>   changes into `master` (owner, 2026-10-02). Releases follow `release.owner: false` (owner, 2026-10-12).
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the coordinator cuts one combined release
>   once the roadmap's items are done.
> - Owner at the keyboard: LT-4 (turn on Dependabot alerts and security updates) and LT-5 (the
>   `SECURITY_ALERTS_TOKEN` secret). MK-8, EN-9, MO-6, BL-8 and DP-8 are done: the release pipeline publishes to
>   npm directly since 0.1.5 (owner, 2026-10-06).

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **LT-4** | `dependabot-config` | `.github/dependabot.yml`: grouped weekly npm and GitHub Actions updates, monthly Docker updates; Dependabot alerts on | — | autonomous | blocked (owner turns on Dependabot alerts and security updates) |
| **LT-5** | `security-alerts-sync` | Open code scanning, Dependabot and secret scanning alerts become `security` issues hourly, closed when the alert is | LT-4 | autonomous | blocked (owner adds the `SECURITY_ALERTS_TOKEN` secret; waits for LT-4) |

## Order

LT-4 first, then LT-5 (it reads the Dependabot alerts LT-4 turns on). LT-2 and LT-3 are done (2026-10-06).

## Items

### LT-4: Dependabot configuration
- **Change ID:** `dependabot-config`
- **Status:** blocked (owner turns on Dependabot alerts and security updates)
- **Input:** [`dependabot-config`](../../backlog/roadmap-later/dependabot-config/change.md)
- **Source:** the owner (2026-11-04): the repository has no `dependabot.yml`, and alerts are only seen when someone
  opens the Security tab.
- **Outcome:** `.github/dependabot.yml` for npm (root workspace), GitHub Actions (workflows and composite actions)
  and the two real Dockerfiles, grouped and limited so the CI load stays at a few runs a week; a repository test
  keeps it valid; `AGENTS.md` says how a Dependabot pull request is merged.
- **Prerequisites:** the owner at the keyboard turns on Dependabot alerts and Dependabot security updates, and
  checks secret scanning and push protection (Settings → Code security).
- **Risk:** low (configuration only; every Dependabot pull request runs the normal gates).

### LT-5: Security alerts as issues
- **Change ID:** `security-alerts-sync`
- **Status:** blocked (owner adds the `SECURITY_ALERTS_TOKEN` secret; waits for LT-4)
- **Input:** [`security-alerts-sync`](../../backlog/roadmap-later/security-alerts-sync/change.md)
- **Source:** the owner (2026-11-04): the agent sessions cannot read code scanning, Dependabot or secret scanning
  alerts, so new alerts are not caught as they appear.
- **Outcome:** an hourly workflow opens one `security` issue per open alert (no duplicates on re-runs) and closes it
  when the alert is fixed or dismissed, so the coordinator's hourly issue check handles alerts like any other issue.
- **Prerequisites:** LT-4 on the main branch; the owner creates a fine-grained token with read access to Dependabot,
  secret scanning and code scanning alerts and saves it as the repository secret `SECURITY_ALERTS_TOKEN`.
- **Unknowns:** whether the issue should carry the `pkg: <name>` label for alerts outside `packages/` paths.
- **Risk:** low (read-only towards the alerts; issues only).

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

- [x] **DP-8** (2026-10-06): both packages are on npm at 0.1.1 with their trusted publishers; the owner marked the
  item done (the workflow tag stays the owner's call).
- [ ] The SSH gateway (`gateway.sh`, forced command) and the Cloudflare-only firewall from FIRE_TRACKER `docker/prod/`
  and `docker/server/`: add them to `softure.vps_foundation` (outside this repository) when convenient.

Added on 2026-11-04 (security alerts):

- [ ] **LT-4**: in Settings → Code security of SOFTURE/AI, turn on Dependabot alerts and Dependabot security updates;
  check that secret scanning and push protection are on.
- [ ] **LT-5**: create a fine-grained personal access token for SOFTURE/AI with read access to Dependabot alerts,
  secret scanning alerts and code scanning alerts, and save it as the repository secret `SECURITY_ALERTS_TOKEN`.

## Done

- **LT-2** `release-version-inline-manifest` (2026-10-06): `release:version` also sets the inline manifest version
  in a module's `src/index.ts`, refusing before any change when it cannot
  ([`archive/2026-10-06-release-version-inline-manifest/`](../../archive/2026-10-06-release-version-inline-manifest/change.md)).
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
- **DP-8** `deploy-release` (2026-10-06): `@softure-ai/deploy` and `@softure-ai/testing` live on npm at 0.1.1; marked
  done by the owner ([`archive/2026-10-04-deploy-release/`](../../archive/2026-10-04-deploy-release/change.md)).
- **LT-3** `testing-browser-hook-timeout` (2026-10-06): Vitest hooks get the 60 s test limit, so a slow Chromium
  launch in the testing package's `beforeAll` no longer fails `npm test`
  ([`archive/2026-10-06-testing-browser-hook-timeout/`](../../archive/2026-10-06-testing-browser-hook-timeout/change.md)).

## Decisions (auto)

- LT-4 and LT-5 added on the owner's word (2026-11-04). → Both wait on the owner at the keyboard (a repository
  setting, a token), which is what this roadmap holds. Alerts become issues instead of giving the sessions new
  access, because the coordinator already checks issues every hour; the workflow's own `GITHUB_TOKEN` cannot read
  Dependabot or secret scanning alerts, hence the secret.

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
