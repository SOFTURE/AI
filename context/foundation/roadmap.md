---
project: "SOFTURE AI"
roadmap: deploy-followups
version: 1
status: ready
prd_version: 2
created: 2026-10-05
updated: 2026-10-06
backlog: context/backlog/roadmap-deploy-followups/
---

# Roadmap deploy-followups: gaps found while delivering the deploy roadmap

> Entries: [`context/backlog/roadmap-deploy-followups/`](../backlog/roadmap-deploy-followups/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
>
> Promoted by the owner on 2026-10-06, with no main roadmap in flight: deploy closed earlier the same day (archived in
> [`archive/2026-10-06-roadmap.md`](archive/2026-10-06-roadmap.md)); its DP-8 waits in
> [`later`](roadmaps/roadmap-later.md). The owner wants DF-1…DF-7 run now, one thread per item; whatever lands is
> released with the next batch. Still queued in [`roadmaps/`](roadmaps/README.md): `charts` (not now, owner
> 2026-10-06) and `later`.
>
> The catch-all of the deploy roadmap (owner, 2026-10-03: gaps found while delivering a roadmap are collected in a
> catch-all roadmap, not fixed on the spot). A thread that finds a new gap while delivering this roadmap:
> 1. takes the next free `DF-<n>` on the current `master` and a kebab-case change-id;
> 2. writes `context/backlog/roadmap-deploy-followups/<change-id>/change.md` (`status: backlog`, the item block
>    quoted in Context, **Source** naming the change and the finding);
> 3. adds the row and the item block here (status `ready`, or `blocked (…)` when it waits on the owner) and the row
>    in the backlog README. Mark the severity in **Risk** and say in **Mode** whether it needs the owner.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain (new → research → frame → plan → plan review → implement →
>   impl review → archive); skipping research or framing is justified in `change.md` (owner, 2026-10-03).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
>
> FIRE_TRACKER (owner, 2026-10-03): read only. Items may copy its code; none changes it.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DF-1** | `deploy-fire-parity` | `env render`, `release-notes`, the deploy workflow, the database steps (`backup`, `schema-guard`, `row-counts`) and `verify` checked against FIRE_TRACKER's scripts and tests; differences ported or recorded | — | owner (read access to FIRE_TRACKER) | ready |
| **DF-2** | `deploy-workflow-verify-config` | the `verify` job of `deploy-app.yml` runs `softure-deploy verify` with the app's `deploy.json` instead of only the health route | DP-4 | autonomous | ready |
| **DF-3** | `deploy-workflow-e2e` | a CI job runs `deploy-app.yml` against a throwaway SSH server and registry, so a broken step fails here, not on the first live deploy | DP-5, DF-7 | autonomous | ready |
| **DF-4** | `auth-testing-account-factory` | `@softure-ai/auth/testing` creates an account in SQL with auth's hashing; the example's e2e uses it outside registration specs | — | autonomous | ready |
| **DF-5** | `deploy-row-count-config` | the tables `row-counts` compares come from `deploy.json` | DP-4 | autonomous | ready |
| **DF-6** | `deploy-verify-cert-expiry` | `verify` fails when the TLS certificate expires within `verify.tlsMinDays` | — | autonomous | ready |
| **DF-7** | `deploy-server-files` | `deploy-app.yml` ships the tag's `docker/prod/` files and `deploy.sh` with each release; no hand copy to the server | DP-5, DF-2 | autonomous | ready |

## Order

Lanes follow file ownership: items in one lane share files, so they run one after another; different lanes run in
parallel, up to 4 at once.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: workflow | DF-2 → DF-7 → DF-3 | `.github/workflows/deploy-app.yml`, `tools/deploy/examples/`, `init`'s `deploy.sh` (DF-7) |
| B: deploy.json | DF-5, DF-6 | `tools/deploy/src/verify/schema.ts` and `schema/deploy.schema.json` (DF-5 also `src/db/`, DF-6 the rest of `src/verify/`) |
| C: auth | DF-4 | `foundation/auth/` (`testing` export), example app e2e |
| D: FIRE parity | DF-1 | all of `tools/deploy/` and `deploy-app.yml` (reads FIRE_TRACKER) |

1. **First wave: DF-2, DF-4, DF-5 and DF-6.** Their prerequisites (DP-4, DP-5) are on `master`. DF-5 and DF-6 both
   add an optional key to the `deploy.json` schema; they run in parallel and the second to merge takes `master`
   and regenerates the JSON Schema.
2. **DF-7** once DF-2 is on `master` (same workflow file); it also reads DF-1's notes on FIRE's gateway if DF-1 has
   landed, otherwise it records that question in its research.
3. **DF-3** once DF-7 is on `master`, so the end-to-end job checks the final protocol. DP-8 (the npm publish)
   waits on the owner, so DF-3 runs the CLI from the checkout through a workflow input.
4. **DF-1** whenever a session can read FIRE_TRACKER (see "Owner at the keyboard?"); it touches every part of
   `tools/deploy/`, so it merges `master` and resolves conflicts itself.

`package-lock.json`, the root `tsconfig` references and the example app are touched by several items; `master` is
the source of truth and each thread merges it and resolves the conflicts itself.

## Owner at the keyboard?

Assessed on 2026-10-06 against what a cloud session cannot do: secrets, provider accounts, servers, DNS, paid API
calls, the owner's own machine, a product decision only the owner can make, or a change in FIRE_TRACKER.

| ID | Needs the owner | Why |
| --- | --- | --- |
| DF-1 | yes, before it starts | cloud sessions cannot clone FIRE_TRACKER (checked again on 2026-10-06); the owner adds it to the sessions' repositories (read only) |
| DF-2 | no | workflow change validated by actionlint and the repository test |
| DF-3 | no | a throwaway `sshd` container and a local registry inside CI; no server or secret; the CLI runs from the checkout because DP-8 waits on the owner |
| DF-4 | no | test-only export tested on PGlite and the example's e2e; it rides auth's next release |
| DF-5 | no | schema key tested locally |
| DF-6 | no | tested against a local TLS server with a generated certificate |
| DF-7 | no | protocol tested with the scripts run locally; no live server |

## Items

### DF-1: Parity of the deploy CLI with FIRE_TRACKER
- **Change ID:** `deploy-fire-parity`
- **Status:** ready
- **Input:** [`deploy-fire-parity`](../backlog/roadmap-deploy-followups/deploy-fire-parity/change.md)
- **Outcome:** FIRE_TRACKER's `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`,
  their tests and `.github/workflows/release-opis.yml` are read; every behaviour and test case that is generic is
  ported into `tools/deploy` (report format, env edge cases), and the rest is listed as FIRE-specific in the
  package README. The same for the deploy workflow (DP-2): FIRE's `.github/workflows/release.yml`,
  `auto-release.yml` and its SSH gateway (`docker/prod/`, the forced command) are read; generic steps
  `deploy-app.yml` lacks (a release report post, image pruning, tagging on merge) are ported or recorded, and the
  forced-command protocol (`<remote-command> <tag>` with `.env.prod` on stdin) is aligned with FIRE's gateway.
  The same for `docker/server/deploy.sh` against DP-3's `backup`, `schema-guard` and `row-counts` (backup format
  and retention default, the guard's cases, which counts it compares and what a drop does).
  The same for `verify` (DP-4) against `scripts/verify-production.sh` (548 lines): every generic check beyond
  status, markers, redirects and headers goes into `deploy.json` and the engine.
- **Prerequisites:** a session that can read FIRE_TRACKER.
- **Unknowns:** whether FIRE's report groups entries differently (by type or label) than DP-1's two sections.
- **Risk:** low. DP-1 is tested on its own; this closes the "same tests green" baseline of DP-1.
- **Source:** DP-1 (`deploy-cli-env-notes`), research: the session could not read FIRE_TRACKER (cloning it was
  refused by the sandbox), so the report format comes from the roadmap, not from FIRE's workflow.
  Extended by DP-2 (`deploy-reusable-workflows`), implementation review: the workflow steps and the gateway
  protocol come from the roadmap too. Extended by DP-3 (`deploy-db-guard`): `deploy.sh` could not be read
  either, so the database steps follow the roadmap item.
  Extended by DP-4 (`deploy-verify-production`), research: the same limit, so verify's generic checks came from
  the roadmap and HTTP semantics.
- **PRD refs:** FR-33.

### DF-2: The deploy workflow verifies with `softure-deploy verify`
- **Change ID:** `deploy-workflow-verify-config`
- **Status:** ready
- **Input:** [`deploy-workflow-verify-config`](../backlog/roadmap-deploy-followups/deploy-workflow-verify-config/change.md)
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
- **Input:** [`deploy-workflow-e2e`](../backlog/roadmap-deploy-followups/deploy-workflow-e2e/change.md)
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
- **Input:** [`auth-testing-account-factory`](../backlog/roadmap-deploy-followups/auth-testing-account-factory/change.md)
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
- **Input:** [`deploy-row-count-config`](../backlog/roadmap-deploy-followups/deploy-row-count-config/change.md)
- **Outcome:** `deploy.json` gets an optional `database.rowCountTables` list (zod schema and JSON Schema);
  `row-counts` reads it when `--tables` is not given.
- **Prerequisites:** DP-4 (`deploy.json`) on `master`.
- **Unknowns:** none.
- **Risk:** low. A convenience; `--tables` works without it. Mode: autonomous, no owner step.
- **Source:** DP-3 (`deploy-db-guard`), plan review S2: DP-4 owned `deploy.json` while DP-3 ran in parallel.
- **PRD refs:** FR-33.

### DF-6: Certificate expiry in verify
- **Change ID:** `deploy-verify-cert-expiry`
- **Status:** ready
- **Input:** [`deploy-verify-cert-expiry`](../backlog/roadmap-deploy-followups/deploy-verify-cert-expiry/change.md)
- **Outcome:** an optional `verify.tlsMinDays`; `verify` reads the certificate with `node:tls` once per run and adds
  a `tls` row to the table (days left, issuer); fewer days than the minimum is a failure. Tested against a local
  TLS server with a generated certificate.
- **Prerequisites:** none.
- **Unknowns:** none.
- **Risk:** low. An expired certificate already fails every route; this only warns earlier.
- **Source:** DP-4 (`deploy-verify-production`), research question 1: `fetch` refuses an invalid or expired
  certificate, but nothing warns before expiry.
- **PRD refs:** FR-33.

### DF-7: Server files shipped with each release
- **Change ID:** `deploy-server-files`
- **Status:** ready
- **Input:** [`deploy-server-files`](../backlog/roadmap-deploy-followups/deploy-server-files/change.md)
- **Outcome:** `deploy-app.yml` sends the tag's `docker/prod/` files (and `docker/server/deploy.sh`) to the server
  with `.env.prod`, for example as one archive on stdin that the forced command unpacks into a release folder before
  it switches; `init`'s `deploy.sh` reads it; the forced-command protocol stays one SSH call.
- **Prerequisites:** DP-5.
- **Unknowns:** whether FIRE's gateway already ships files (DF-1 reads it).
- **Risk:** medium. A missed copy runs a release against an older compose file; nothing fails loudly.
- **Source:** DP-5 (`deploy-init-template`), plan review S3: the workflow sends only `.env.prod`, so the files `init`
  generates are copied to `/srv/<name>/` once and again whenever they change.
- **PRD refs:** FR-33, FR-34.

## Owner decisions and checks

(none yet)

## Done

(nothing yet)
