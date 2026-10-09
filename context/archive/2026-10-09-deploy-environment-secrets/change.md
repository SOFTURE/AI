---
change_id: deploy-environment-secrets
title: "deploy-app.yml: read app secrets and the SSH values from the deploy job's GitHub Environment (issue #296)"
status: archived
roadmap_item: null
issue: 296
branch: claude/project-thread-dhe6os
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #296](https://github.com/SOFTURE/AI/issues/296): an app that keeps its runtime secrets and its deploy key
only in a GitHub Environment (`production`, whose deployment policy admits only release tags) cannot deploy with
`deploy-app.yml`. A caller's `secrets:` are evaluated in the caller's job, which cannot name an environment, and an
environment secret cannot carry the workflow's secret names (`app-secrets`, `ssh-private-key`, ...), so nothing of the
environment reaches the deploy job. The only workaround (repository-level copies) drops the tag-only policy.

An opt-in input lets the deploy job, which runs in the environment, read the secrets itself:

1. a caller whose required names and deploy key exist only as environment secrets deploys: `.env.prod` holds exactly
   the compose names, and the archive goes over SSH with the environment's key;
2. the flag without `environment` is refused by the `check` job;
3. callers without the flag behave as today (the e2e is unchanged);
4. the README's deploy workflow section and `examples/deploy.yml` show both forms.

## Context

Issue #296 (labels `enhancement`, `pkg: deploy`, `adoption`, `blocker`). Work is tracked in GitHub Issues: no roadmap
item; the PR closes the issue. Issue #297 changes the same package and README in parallel, so this change does not
release `@softure-ai/deploy`; its CHANGELOG entry goes under `## Unreleased`.

## Constraints

- Scope: `.github/workflows/deploy-app.yml`, `tools/deploy` (README, CHANGELOG, example caller, tests),
  `tests/repo/deploy-workflows.test.ts`.
- Today's behaviour stays the default: a call without the new inputs behaves as before, apart from where a missing
  required secret is reported (below).
- No step prints a secret's value; the check job sees whether a named secret was passed, never its value.
- The shell the tests run stays within bash 3.2 and BSD/GNU-common flags (AGENTS.md).
- English-only code and docs; no names of adopting apps in the repository.

## Process notes

- Research: a short `research.md` records how secrets reach the workflow today and what GitHub allows.
- Framing: skipped. The gap is observed by the adopter, the issue proposes the remedy and the acceptance criteria;
  the open choices (how the verify job gets the origin address, what happens to `required: true`) are settled in
  plan.md.
