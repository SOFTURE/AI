---
project: "SOFTURE AI"
roadmap: deploy
version: 1
status: waiting
prd_version: 2
created: 2026-10-04
updated: 2026-10-04
backlog: context/backlog/roadmap-deploy/
trigger: "the owner promotes it, at the earliest when the blog roadmap closes"
---

# Roadmap deploy: one-VPS deploy as a package, reusable workflows and test tools

> Reference: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) ("Deploy: package or
> template"), PRD v2 FR-33…FR-35.
>
> Entries: [`context/backlog/roadmap-deploy/`](../../backlog/roadmap-deploy/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote deploy`).
>
> Written on 2026-10-04 from the second FIRE_TRACKER analysis, next to the main roadmap
> [`blog`](../archive/2026-10-04-2-roadmap.md) (closed on 2026-10-04). The split (owner, 2026-10-04, on the analysis): logic that does not change from app to
> app (pipeline, secret rendering, backup, schema guard, verify) goes into `@softure-ai/deploy` and reusable
> workflows; whatever describes one app (compose, Traefik rules, Dockerfile) is generated once by
> `softure-deploy init` and then owned by the app.
>
> Out of this repository: the SSH gateway with a forced command and the Cloudflare-only firewall are server
> configuration installed once. They belong in the owner's `softure.vps_foundation` Ansible collection, not in npm;
> no item here builds them (see "Owner decisions and checks").
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: the full softure chain for every item (owner, 2026-10-03).
> - Owner at the keyboard: DP-8 only (first npm publishes, the workflow tag).

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DP-1** | `deploy-cli-env-notes` | `@softure-ai/deploy` CLI: `env render` from secrets (names from the compose file), release notes as a live report | — | autonomous | ready |
| **DP-2** | `deploy-reusable-workflows` | `workflow_call` workflows: build the image to GHCR, deploy over SSH, verify; an app keeps one `uses:` line | DP-1 | autonomous | ready |
| **DP-3** | `deploy-db-guard` | backup before a deploy, a schema guard on the `@softure-ai/db` ledger and row counts before and after from an app hook | DP-1 | autonomous | ready |
| **DP-4** | `deploy-verify-production` | `softure-deploy verify`: routes, expected statuses, markers, redirects and headers from `deploy.json` | DP-1 | autonomous | ready |
| **DP-5** | `deploy-init-template` | `softure-deploy init` writes compose, Traefik rules, Dockerfile, the server script and the caller workflow once | DP-2, DP-3, DP-4 | autonomous | ready |
| **DP-6** | `testing-clock-shift` | `@softure-ai/testing`: a Vitest setup that shifts the test clock to `TEST_TODAY` | — | autonomous | ready |
| **DP-7** | `testing-playwright-helpers` | generic Playwright helpers (login, factories, select, wait-for, links, assertions) used by the example app's e2e | DP-6 | autonomous | ready |
| **DP-8** | `deploy-release` | `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published; the deploy workflows tagged for callers | DP-1…DP-7 | owner | blocked (waits for DP-1…DP-7 and the owner's first npm publish at the keyboard) |

## Order

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: deploy CLI | DP-1 → DP-3 → DP-4 | `tools/deploy/` (`src/env/`, `src/notes/`, `src/db/`, `src/verify/`) |
| B: workflows | DP-2 (after DP-1) | `.github/workflows/deploy-*.yml` |
| C: init | DP-5 (after DP-2, DP-3, DP-4) | `tools/deploy/templates/`, `src/init/` |
| D: testing | DP-6 → DP-7 | `foundation/testing/`, example app e2e helpers |

1. **First wave: DP-1 and DP-6** (independent packages).
2. **After DP-1:** DP-2, DP-3 and DP-4 can run in parallel if each keeps to its own folder and CLI command file;
   the CLI entry point is merged from `master`. DP-7 after DP-6.
3. **DP-5** last of the code items: it generates files that call DP-2, DP-3 and DP-4.
4. **DP-8** (owner) once DP-1…DP-7 are merged.

## Owner at the keyboard?

| ID | Needs the owner | Why |
| --- | --- | --- |
| DP-1, DP-3, DP-4, DP-5 | no | CLI code tested locally and on the CI Postgres; no server touched |
| DP-2 | no | workflow files validated by actionlint and an example caller; no real deploy runs from this repository |
| DP-6, DP-7 | no | test tools exercised by this repository's own tests and e2e |
| DP-8 | yes | first (staged) npm publishes and the workflow tag for callers |

## Items

### DP-1: Deploy CLI: env rendering and release notes
- **Change ID:** `deploy-cli-env-notes`
- **Status:** ready
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
- **Status:** ready
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
- **Status:** blocked (waits for DP-1…DP-7 and the owner's first npm publish at the keyboard)
- **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2) set by the owner; READMEs with an adoption guide for FIRE_TRACKER.
- **Prerequisites:** DP-1…DP-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, FR-26, G-4.

## Owner decisions and checks

- [ ] **DP-8**: approve the first (staged) publish of `@softure-ai/deploy` and `@softure-ai/testing` on npmjs.com,
  add a trusted publisher for each, and set the workflow tag callers use (DP-2).
- [ ] The SSH gateway (`gateway.sh`, forced command) and the Cloudflare-only firewall from FIRE_TRACKER `docker/prod/`
  and `docker/server/`: add them to `softure.vps_foundation` (outside this repository) when convenient.

## Done

(nothing yet)
