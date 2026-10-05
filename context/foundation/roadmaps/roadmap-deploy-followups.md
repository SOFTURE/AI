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
| **DF-1** | `deploy-fire-parity` | `env render` and `release-notes` checked against FIRE_TRACKER's scripts and tests; differences ported or recorded | — | autonomous | ready |
| **DF-2** | `auth-testing-account-factory` | `@softure-ai/auth/testing` creates an account in SQL with auth's hashing; the example's e2e uses it outside registration specs | — | autonomous | ready |

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
  package README.
- **Prerequisites:** a session that can read FIRE_TRACKER.
- **Unknowns:** whether FIRE's report groups entries differently (by type or label) than DP-1's two sections.
- **Risk:** low. DP-1 is tested on its own; this closes the "same tests green" baseline of DP-1.
- **Source:** DP-1 (`deploy-cli-env-notes`), research: the session could not read FIRE_TRACKER (cloning it was
  refused by the sandbox), so the report format comes from the roadmap, not from FIRE's workflow.
- **PRD refs:** FR-33.

### DF-2: Account factory in auth's testing export
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

## Owner decisions and checks

(none yet)

## Done

(nothing yet)
