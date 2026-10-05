---
project: "SOFTURE AI"
roadmap: deploy
version: 1
status: ready
prd_version: 2
created: 2026-10-04
updated: 2026-10-05
backlog: context/backlog/roadmap-deploy/
---

# Roadmap deploy: one-VPS deploy as a package, reusable workflows and test tools

> Reference: [`docs/06-fire-extraction-2.md`](../../docs/06-fire-extraction-2.md) ("Deploy: package or
> template"), PRD v2 FR-33…FR-35.
>
> Entries: [`context/backlog/roadmap-deploy/`](../backlog/roadmap-deploy/). An entry is taken (moved to
> `context/changes/<id>/`) when its item starts.
>
> Promoted by the owner on 2026-10-05, with no main roadmap in flight: blog-followups closed earlier the same day
> (archived in [`archive/2026-10-05-roadmap.md`](archive/2026-10-05-roadmap.md)). The owner wants DP-1…DP-7 done
> on 2026-10-05 and does the keyboard steps (DP-8, the checks below) on 2026-10-06 from their own machine; nothing
> in this roadmap deploys to a server. Still queued in [`roadmaps/`](roadmaps/README.md): `charts` and `later`
> (BL-8, MK-8, EN-9 and MO-6 wait on the owner there).
>
> Written on 2026-10-04 from the second FIRE_TRACKER analysis. The split (owner, 2026-10-04, on the analysis): logic
> that does not change from app to app (pipeline, secret rendering, backup, schema guard, verify) goes into
> `@softure-ai/deploy` and reusable workflows; whatever describes one app (compose, Traefik rules, Dockerfile) is
> generated once by `softure-deploy init` and then owned by the app.
>
> Out of this repository: the SSH gateway with a forced command and the Cloudflare-only firewall are server
> configuration installed once. They belong in the owner's `softure.vps_foundation` Ansible collection, not in npm;
> no item here builds them (see "Owner decisions and checks"). FIRE_TRACKER's own switch to these tools (secrets,
> server, DNS) happens in FIRE_TRACKER's roadmap, not here.
>
> Gaps found while delivering this roadmap are collected, not fixed on the spot (owner, 2026-10-03): the first gap
> creates the queued catch-all `deploy-followups` (`context/foundation/roadmaps/roadmap-deploy-followups.md` and
> `context/backlog/roadmap-deploy-followups/`, prefix `DF-`); each gap gets the next `DF-<n>`, a backlog entry
> (`status: backlog`, **Source** naming the change and the finding) and a row, with the severity in **Risk** and
> the owner's part in **Mode**.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain (new → research → frame → plan → plan review → implement →
>   impl review → archive); skipping research or framing is justified in `change.md` (owner, 2026-10-03).
> - Release: the two packages are new, so their changes ride their first publish (DP-8); no item bumps a
>   published package unless it changes one.
> - Owner at the keyboard: DP-8 and the checks in "Owner decisions and checks", on 2026-10-06.
>
> FIRE_TRACKER (owner, 2026-10-03): read only. Items may copy its code; none changes it.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DP-1** | `deploy-cli-env-notes` | `@softure-ai/deploy` CLI: `env render` from secrets (names from the compose file), release notes as a live report | — | autonomous | done_code (2026-10-05; waiting: the first publish of `@softure-ai/deploy`, DP-8) |
| **DP-2** | `deploy-reusable-workflows` | `workflow_call` workflows: build the image to GHCR, deploy over SSH, verify; an app keeps one `uses:` line | DP-1 | autonomous | ready |
| **DP-3** | `deploy-db-guard` | backup before a deploy, a schema guard on the `@softure-ai/db` ledger and row counts before and after from an app hook | DP-1 | autonomous | **in_progress** (implement 1/3, since 2026-10-05; cloud session, branch `claude/project-thread-ot1p2c` — do not take in another session) |
| **DP-4** | `deploy-verify-production` | `softure-deploy verify`: routes, expected statuses, markers, redirects and headers from `deploy.json` | DP-1 | autonomous | ready |
| **DP-5** | `deploy-init-template` | `softure-deploy init` writes compose, Traefik rules, Dockerfile, the server script and the caller workflow once | DP-2, DP-3, DP-4 | autonomous | ready |
| **DP-6** | `testing-clock-shift` | `@softure-ai/testing`: a Vitest setup that shifts the test clock to `TEST_TODAY` | — | autonomous | ready |
| **DP-7** | `testing-playwright-helpers` | generic Playwright helpers (login, factories, select, wait-for, links, assertions) used by the example app's e2e | DP-6 | autonomous | ready |
| **DP-8** | `deploy-release` | `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published; the deploy workflows tagged for callers | DP-1…DP-7 | owner | blocked (waits for DP-1…DP-7 and the owner at the keyboard on 2026-10-06) |

## Order

Lanes follow file ownership: items in one lane share files, so they run one after another; different lanes run in
parallel, up to 4 at once.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: deploy CLI | DP-1 → DP-3 → DP-4 | `tools/deploy/` (`src/env/`, `src/notes/`, `src/db/`, `src/verify/`) |
| B: workflows | DP-2 (after DP-1) | `.github/workflows/deploy-*.yml` |
| C: init | DP-5 (after DP-2, DP-3, DP-4) | `tools/deploy/templates/`, `src/init/` |
| D: testing | DP-6 → DP-7 | `foundation/testing/`, example app e2e helpers |

1. **First wave: DP-1 and DP-6** (independent packages, both start on 2026-10-05).
2. **After DP-1 is on `master`:** DP-2, DP-3 and DP-4 run in parallel, each in its own folder and CLI command
   file; the CLI entry point (`tools/deploy/src/cli/`) is merged from `master` and each thread resolves the
   conflicts itself. DP-7 starts as soon as DP-6 is on `master`.
3. **DP-5** last of the code items: it generates files that call DP-2, DP-3 and DP-4.
4. **DP-8** (owner, 2026-10-06) once DP-1…DP-7 are merged.

At most four run at once: DP-1 and DP-6, then up to DP-2, DP-3, DP-4 and DP-7 together. `package-lock.json`, the
root `tsconfig` references and the example app are touched by several items; `master` is the source of truth and
each thread merges it and resolves the conflicts itself.

## Owner at the keyboard?

Assessed on 2026-10-05 against what a cloud session cannot do: secrets, provider accounts, servers, DNS, paid API
calls, the owner's own machine, a product decision only the owner can make, or a change in FIRE_TRACKER.
None of DP-1…DP-7 needs one, so they run on 2026-10-05; everything that does is on 2026-10-06.

| ID | Needs the owner | When | Why |
| --- | --- | --- | --- |
| DP-1 | no | 2026-10-05 | env rendering is tested with fake names and values; release notes from `git log` or a CI token, no new secret |
| DP-2 | no (one check tomorrow) | 2026-10-05 | workflow files validated by actionlint and an example caller; no real deploy runs from this repository. Whether the owner's other repositories may call them is an Actions setting the owner checks on 2026-10-06 |
| DP-3 | no | 2026-10-05 | backup and schema guard tested on the CI and local Postgres; no production database touched |
| DP-4 | no | 2026-10-05 | verify tested against a local server; no live URL |
| DP-5 | no | 2026-10-05 | generated into a temp folder; the example app's image builds in CI; no server, DNS or certificate |
| DP-6 | no | 2026-10-05 | a test setup exercised by this repository's tests |
| DP-7 | no | 2026-10-05 | helpers exercised by the example app's e2e on the local Postgres |
| DP-8 | yes | 2026-10-06 | first (staged) npm publishes, trusted publishers and the workflow tag for callers |

## Items

### DP-1: Deploy CLI: env rendering and release notes
- **Change ID:** `deploy-cli-env-notes`
- **Status:** done_code (2026-10-05; waiting: the first publish of `@softure-ai/deploy`, DP-8)
- **Input:** [`deploy-cli-env-notes`](../archive/2026-10-05-deploy-cli-env-notes/change.md)
- **Outcome:** A new package `@softure-ai/deploy` (`tools/deploy/`, a CLI like marketing-kit) with:
  - `softure-deploy env render`: reads required names from `${X:?}` in the production compose file and writes `.env.prod` from the environment, refusing a missing name and never printing values;
  - `softure-deploy release-notes`: the release report between two tags from commits and merged pull requests, in the format FIRE's release workflow posts.
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:** Whether release notes read the GitHub API (token in CI) or only `git log` with merge commits.
- **Risk:** low.
- **Baseline:** FIRE `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts` and tests. After: the same tests green in the package; bash replaced by TS.
- **PRD refs:** FR-33, NFR-5.
- **Source (FIRE_TRACKER, read only):** `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`, `.github/workflows/release-opis.yml`

### DP-2: Reusable deploy workflows
- **Change ID:** `deploy-reusable-workflows`
- **Status:** ready
- **Input:** [`deploy-reusable-workflows`](../backlog/roadmap-deploy/deploy-reusable-workflows/change.md)
- **Outcome:** Reusable GitHub workflows in this repository (`.github/workflows/deploy-*.yml`, `on: workflow_call`):
  - build and push the image to GHCR with the release tag;
  - deploy over SSH through the server's forced command, with env rendered by DP-1;
  - verify (DP-4 once merged; a health check until then);
  - inputs for the two domain spots FIRE hard-codes; secrets passed explicitly; minimal `permissions`;
  - an example caller workflow and a test that validates the workflow files.
- **Prerequisites:** DP-1.
- **Unknowns:**
  - Versioning for callers (`@v1` tag the owner moves vs. a commit SHA).
  - Whether a reusable workflow in a private repository can be called by the owner's other repositories (organization setting).
- **Risk:** medium. CI that deploys to production; a bad input reaches a live server.
- **Baseline:** FIRE `.github/workflows/{release,auto-release}.yml` (381 lines, 2 domain spots). After: the same steps behind `workflow_call`, validated by actionlint in CI.
- **PRD refs:** FR-33.
- **Source (FIRE_TRACKER, read only):** `.github/workflows/release.yml`, `.github/workflows/auto-release.yml`

### DP-3: Backup and schema guard before a deploy
- **Change ID:** `deploy-db-guard`
- **Status:** **in_progress** (implement 1/3, since 2026-10-05; cloud session, branch `claude/project-thread-ot1p2c` — do not take in another session)
- **Input:** [`deploy-db-guard`](../changes/deploy-db-guard/change.md)
- **Outcome:**
  - `softure-deploy backup`: a `pg_dump` before the deploy with retention;
  - `softure-deploy schema-guard`: reads the `@softure-ai/db` migration ledger and refuses a deploy whose image expects migrations the database cannot take (checksum or order);
  - row counts before and after the deploy for a table list from the app's config (FIRE's `users/snapshots/position_values` becomes config).
- **Prerequisites:** DP-1.
- **Unknowns:** Whether the guard runs inside the new image (it has the migrations) or on the host before the switch.
- **Risk:** medium. Production data safety.
- **Baseline:** FIRE `docker/server/deploy.sh` (backup, schema guard on the drizzle table, counts). After: the same checks in TS against the softure ledger, tested on Postgres.
- **PRD refs:** FR-33, NFR-4.
- **Source (FIRE_TRACKER, read only):** `docker/server/deploy.sh`

### DP-4: Production verify from config
- **Change ID:** `deploy-verify-production`
- **Status:** ready
- **Input:** [`deploy-verify-production`](../backlog/roadmap-deploy/deploy-verify-production/change.md)
- **Outcome:**
  - `deploy.json` (zod schema, published as JSON Schema): routes with expected status, body markers, redirects and headers;
  - `softure-deploy verify <url>`: runs every check, prints a table, exits non-zero on a failure;
  - FIRE's route lists stay in FIRE's `deploy.json`.
- **Prerequisites:** DP-1.
- **Unknowns:** Which checks of FIRE's 548-line script are generic beyond routes (TLS, headers, robots).
- **Risk:** low.
- **Baseline:** FIRE `scripts/verify-production.sh` (548 lines, 100+ of FIRE routes). After: the engine in TS with tests against a local server.
- **PRD refs:** FR-33.
- **Source (FIRE_TRACKER, read only):** `scripts/verify-production.sh`

### DP-5: Deploy files generated once
- **Change ID:** `deploy-init-template`
- **Status:** ready
- **Input:** [`deploy-init-template`](../backlog/roadmap-deploy/deploy-init-template/change.md)
- **Outcome:** `softure-deploy init` generates files the app then owns (never overwrites without `--force`):
  - production `docker-compose.yml` and Traefik rules (apex router with the app's allowed paths);
  - a `Dockerfile` for a Next standalone build;
  - the server `deploy.sh` that calls DP-3 and the caller workflow for DP-2;
  - a `deploy.json` starter for DP-4.

  A test generates into a temp folder and builds the example app's image in CI.
- **Prerequisites:** DP-2, DP-3, DP-4.
- **Unknowns:** Which answers `init` asks (domain, services, migrations step) and which it reads from `softure.config`.
- **Risk:** medium.
- **Baseline:** FIRE `docker/**`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`, `docker/server/deploy.sh`. After: generated files for the example app that build.
- **PRD refs:** FR-34.
- **Source (FIRE_TRACKER, read only):** `docker/Dockerfile`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`, `docker/server/deploy.sh`

### DP-6: Test clock shift
- **Change ID:** `testing-clock-shift`
- **Status:** ready
- **Input:** [`testing-clock-shift`](../backlog/roadmap-deploy/testing-clock-shift/change.md)
- **Outcome:** A new package `@softure-ai/testing` (`foundation/testing/`, copied from `templates/package/`):
  - a Vitest setup file that shifts `Date` to `TEST_TODAY` (or a fixed default) while time keeps running, so date logic tests do not rot;
  - documented next to the injectable clock in `@softure-ai/core`.
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:** How it composes with `vi.useFakeTimers` in the same file.
- **Risk:** low.
- **Baseline:** FIRE `vitest.shift-clock.ts`. After: the setup in the package with its tests.
- **PRD refs:** FR-35.
- **Source (FIRE_TRACKER, read only):** `vitest.shift-clock.ts`

### DP-7: Playwright helpers
- **Change ID:** `testing-playwright-helpers`
- **Status:** ready
- **Input:** [`testing-playwright-helpers`](../backlog/roadmap-deploy/testing-playwright-helpers/change.md)
- **Outcome:** `@softure-ai/testing/playwright`:
  - login through `@softure-ai/auth`, data factories over `@softure-ai/db`;
  - select, wait-for, links and assertion helpers;
  - the example app's e2e moves to them where they fit; FIRE's `snapshot-form` stays in FIRE.
- **Prerequisites:** DP-6.
- **Unknowns:** Whether factories belong here or in each module's own testing export.
- **Risk:** low.
- **Baseline:** FIRE `integration/infrastructure/*` (about 70% generic). After: the helpers in the package, the example app e2e green on them.
- **PRD refs:** FR-35, FR-9.
- **Source (FIRE_TRACKER, read only):** `integration/infrastructure/*` (without `snapshot-form.ts`)

### DP-8: Deploy and testing release
- **Change ID:** `deploy-release`
- **Status:** blocked (waits for DP-1…DP-7 and the owner at the keyboard on 2026-10-06)
- **Input:** [`deploy-release`](../backlog/roadmap-deploy/deploy-release/change.md)
- **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2) set by the owner; READMEs with an adoption guide for FIRE_TRACKER. `tools/deploy/package.json` carries `"private": true` until then (DP-1), so an `auto-release` of `all` cannot publish it early; DP-8 removes it.
- **Prerequisites:** DP-1…DP-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, FR-26, G-4.

## Owner decisions and checks

All of these are for the owner at the keyboard on 2026-10-06.

- [ ] **DP-8**: approve the first (staged) publish of `@softure-ai/deploy` and `@softure-ai/testing` on npmjs.com,
  add a trusted publisher for each, and set the workflow tag callers use (DP-2).
- [ ] **DP-2**: in this repository's Settings → Actions → General → Access, allow the owner's other repositories to
  call its reusable workflows (needed only if the repository stays private).
- [ ] The SSH gateway (`gateway.sh`, forced command) and the Cloudflare-only firewall from FIRE_TRACKER `docker/prod/`
  and `docker/server/`: add them to `softure.vps_foundation` (outside this repository) when convenient.

## Done

- **DP-1** `deploy-cli-env-notes`: `@softure-ai/deploy` with `softure-deploy env render` (names from the compose file, values never printed, `.env.prod` 0600) and `release-notes` (git log only, en/pl); gap DF-1 (FIRE_TRACKER parity) queued in `deploy-followups`; archived in `archive/2026-10-05-deploy-cli-env-notes/`
