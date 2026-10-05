---
project: "SOFTURE AI"
roadmap: deploy-followups
version: 1
status: waiting
prd_version: 2
created: 2026-10-05
updated: 2026-10-05
backlog: context/backlog/roadmap-deploy-followups/
trigger: "the deploy roadmap closes; the owner promotes it or takes single items"
---

# Roadmap deploy-followups: gaps found while delivering the deploy roadmap

> Entries: [`context/backlog/roadmap-deploy-followups/`](../../backlog/roadmap-deploy-followups/). Queued roadmap
> (WORKFLOW §5.1): nothing here runs until the owner promotes it to `roadmap.md`
> (`softure-roadmap --promote deploy-followups`) or moves a single item into the main roadmap.
>
> The catch-all of the [`deploy`](../roadmap.md) roadmap (owner, 2026-10-03: gaps found while delivering a roadmap
> are collected in a catch-all roadmap, not fixed on the spot). Created with its first gap (DF-1, from DP-1). A
> thread that finds a gap or a deferred review finding:
> 1. takes the next free `DF-<n>` on the current `master` and a kebab-case change-id;
> 2. writes `context/backlog/roadmap-deploy-followups/<change-id>/change.md` (`status: backlog`, the item block
>    quoted in Context, **Source** naming the change and the finding);
> 3. adds the row and the item block here (status `ready`, or `blocked (…)` when it waits on the owner) and the row
>    in the backlog README. Mark the severity in **Risk** and say in **Mode** whether it needs the owner.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
>
> FIRE_TRACKER (owner, 2026-10-03): read only. Items may copy its code; none changes it.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DF-1** | `deploy-fire-parity` | `env render`, `release-notes`, the deploy workflow and the database steps (`backup`, `schema-guard`, `row-counts`) checked against FIRE_TRACKER's scripts and tests; differences ported or recorded | — | autonomous | ready |
| **DF-2** | `deploy-workflow-verify-config` | the `verify` job of `deploy-app.yml` runs `softure-deploy verify` with the app's `deploy.json` instead of only the health route | DP-4 | autonomous | ready |
| **DF-3** | `deploy-workflow-e2e` | a CI job runs `deploy-app.yml` against a throwaway SSH server and registry, so a broken step fails here, not on the first live deploy | DP-5, DP-8 | autonomous | ready |
| **DF-4** | `auth-testing-account-factory` | `@softure-ai/auth/testing` creates an account in SQL with auth's hashing; the example's e2e uses it outside registration specs | — | autonomous | ready |
| **DF-5** | `deploy-row-count-config` | the tables `row-counts` compares come from `deploy.json` | DP-4 | autonomous | ready |

## Order

Lanes are set when the roadmap is promoted, by shared files.

## Items

### DF-1: Parity of the deploy CLI with FIRE_TRACKER
- **Change ID:** `deploy-fire-parity`
- **Status:** ready
- **Input:** [`deploy-fire-parity`](../../backlog/roadmap-deploy-followups/deploy-fire-parity/change.md)
- **Outcome:** FIRE_TRACKER's `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`,
  their tests and `.github/workflows/release-opis.yml` are read; every behaviour and test case that is generic is
  ported into `tools/deploy` (report format, env edge cases), and the rest is listed as FIRE-specific in the
  package README. The same for the deploy workflow (DP-2): FIRE's `.github/workflows/release.yml`,
  `auto-release.yml` and its SSH gateway (`docker/prod/`, the forced command) are read; generic steps
  `deploy-app.yml` lacks (a release report post, image pruning, tagging on merge) are ported or recorded, and the
  forced-command protocol (`<remote-command> <tag>` with `.env.prod` on stdin) is aligned with FIRE's gateway.
  The same for `docker/server/deploy.sh` against DP-3's `backup`, `schema-guard` and `row-counts` (backup format
  and retention default, the guard's cases, which counts it compares and what a drop does).
- **Prerequisites:** a session that can read FIRE_TRACKER.
- **Unknowns:** whether FIRE's report groups entries differently (by type or label) than DP-1's two sections.
- **Risk:** low. DP-1 is tested on its own; this closes the "same tests green" baseline of DP-1.
- **Source:** DP-1 (`deploy-cli-env-notes`), research: the session could not read FIRE_TRACKER (cloning it was
  refused by the sandbox), so the report format comes from the roadmap, not from FIRE's workflow.
  Extended by DP-2 (`deploy-reusable-workflows`), implementation review: the workflow steps and the gateway
  protocol come from the roadmap too. Extended by DP-3 (`deploy-db-guard`): `deploy.sh` could not be read
  either, so the database steps follow the roadmap item.
- **PRD refs:** FR-33.

### DF-2: The deploy workflow verifies with `softure-deploy verify`
- **Change ID:** `deploy-workflow-verify-config`
- **Status:** ready
- **Input:** [`deploy-workflow-verify-config`](../../backlog/roadmap-deploy-followups/deploy-workflow-verify-config/change.md)
- **Outcome:** The `verify` job runs `softure-deploy verify <app-url>` (DP-4) from the CLI version the workflow pins, reading the
  app's `deploy.json` from the release tag; the health-route wait stays as the first step, so verify starts once the
  new release answers.
- **Prerequisites:** DP-4 on `master`.
- **Unknowns:** whether `deploy.json` is required or optional (fall back to the health route).
- **Risk:** low. Today the workflow checks only `/api/health`.
- **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
- **PRD refs:** FR-33.

### DF-3: The deploy workflow runs end to end in CI
- **Change ID:** `deploy-workflow-e2e`
- **Status:** ready
- **Input:** [`deploy-workflow-e2e`](../../backlog/roadmap-deploy-followups/deploy-workflow-e2e/change.md)
- **Outcome:** A workflow in this repository calls `./.github/workflows/deploy-app.yml` for the example app against a local
  `sshd` container with a forced command that records what it received and a local registry (or `push: false`
  through an input), asserting the image, the command line and the rendered `.env.prod` names.
- **Prerequisites:** DP-5 (the example app's production compose and Dockerfile) and `@softure-ai/deploy` on npm (DP-8), or an input to run the CLI from the checkout.
- **Unknowns:** whether GHCR can be swapped for a local registry without an input that production callers could misuse.
- **Risk:** medium. DP-2 is validated statically only (actionlint, the repository test, the scripts run by hand).
- **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
- **PRD refs:** FR-33.

### DF-4: Account factory in auth's testing export
- **Change ID:** `auth-testing-account-factory`
- **Status:** ready
- **Input:** [`auth-testing-account-factory`](../../backlog/roadmap-deploy-followups/auth-testing-account-factory/change.md)
- **Outcome:** `@softure-ai/auth/testing` with `createTestAccount(db, { email, password, roles? })` that writes
  the `users` row (and roles) with auth's hashing; the example's e2e registers through the form only in the
  specs about registration; auth bumps its version.
- **Prerequisites:** none.
- **Unknowns:** whether the factory takes a `@softure-ai/db` handle or a drizzle instance.
- **Risk:** low. Test-only export; it changes a published package, so it rides auth's next release.
- **Source:** DP-7 (`testing-playwright-helpers`), research: FIRE_TRACKER's `integration/infrastructure/auth.ts`
  creates accounts in SQL; DP-7 decided module-specific factories belong in each module's own `testing`
  export (precedent: `@softure-ai/mailing/testing`), and adding one to auth was outside DP-7.
- **PRD refs:** FR-35, FR-9.

### DF-5: Row-count tables from deploy.json
- **Change ID:** `deploy-row-count-config`
- **Status:** ready
- **Input:** [`deploy-row-count-config`](../../backlog/roadmap-deploy-followups/deploy-row-count-config/change.md)
- **Outcome:** `deploy.json` gets an optional `database.rowCountTables` list (zod schema and JSON Schema);
  `row-counts` reads it when `--tables` is not given.
- **Prerequisites:** DP-4 (`deploy.json`) on `master`.
- **Unknowns:** none.
- **Risk:** low. A convenience; `--tables` works without it. Mode: autonomous, no owner step.
- **Source:** DP-3 (`deploy-db-guard`), plan review S2: DP-4 owned `deploy.json` while DP-3 ran in parallel.
- **PRD refs:** FR-33.

## Owner decisions and checks

(none yet)

## Done

(nothing yet)
