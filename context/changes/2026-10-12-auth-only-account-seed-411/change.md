---
change_id: auth-only-account-seed-411
title: "auth: export the single-account resolver and a seed command (issue #411)"
status: open
roadmap_item: null
issue: 411
branch: claude/project-thread-9xkl5i
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #411](https://github.com/SOFTURE/AI/issues/411) (labels `enhancement`, `pkg: auth`, `pkg: mcp-access`,
`adoption`): two pieces an adopting app still writes itself.

1. `resolveOnlyAccount({ db, envName, env? })` in `@softure-ai/auth/server`: the account id named by an environment
   variable (it must name an existing account), else the only account in the database; refuses with a readable reason
   when there is none, or several and none is named. `@softure-ai/mcp-access` stdio uses it instead of its private copy.
2. `runSeedAccount({ config, env? })` in `@softure-ai/auth/scripts`: a development login account from `SEED_EMAIL` /
   `SEED_PASSWORD` through `registerUser` (the app's `onRegistered` hook runs, refusals are readable), idempotent.

A reviewer checks `modules/auth/tests/only-account-seed.test.ts`, the existing stdio tests in mcp-access (unchanged
codes and messages), both READMEs and both CHANGELOG `Unreleased` entries.

## Context

auth is at 0.1.12, mcp-access at 0.1.13 on master. Releases are batched by the coordinator: no version bump here.

## Constraints

- mcp-access keeps its error codes (`mcp-access.stdio_*`) and messages byte for byte.
- No new runtime dependency; the seed entry needs no `@softure-ai/ops`.

## Process notes

- Framing: skipped. The issue names both pieces and the proposed API.

## Decisions (auto)

- Resolver returns a value (`Ok<string>` or `Err<code> & { message }`), never throws for an expected case; codes
  `auth.account_unknown`, `auth.no_account`, `auth.account_ambiguous`. mcp-access maps them to its own codes and text.
- Seed is a `/scripts` entry (`runSeedAccount`, returns the exit code), not a new bin: the app runs it with tsx like
  its other scripts, and auth gains no bin to maintain.
- Seed is idempotent: an existing account with that email is "already there", exit 0, nothing changed (the password
  is not reset). It refuses under `NODE_ENV=production` (a development account), and ends the session that
  registration opens, so it leaves only the account.
- Seed registers with consent given and a fixed rate limit key `script:seed`.

## Before the next release

- Release auth before (or with) mcp-access and raise mcp-access's `@softure-ai/auth` range to that auth version:
  mcp-access now imports `resolveOnlyAccount`, which `auth@0.1.12` does not have.
