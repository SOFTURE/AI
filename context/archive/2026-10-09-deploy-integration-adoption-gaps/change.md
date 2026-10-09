---
change_id: deploy-integration-adoption-gaps
title: "deploy integration: flaky line, Playwright JSON results, prebuilt-image mode, notes and ref names (issue #308)"
status: archived
roadmap_item: null
issue: 308
branch: claude/project-thread-epbtfc
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #308](https://github.com/SOFTURE/AI/issues/308): an adopting app that runs its remote integration run by
hand cannot switch to `softure-deploy integration run|lookup|record` and `deploy-integration.yml` because of four gaps.

1. The contract prints a `flaky:` line per test that passed only on a retry, so a skill can judge a green run with
   retries.
2. `integration record` reads Playwright's JSON report as well as JUnit (`--results=<path>
   --format=playwright-json|junit`).
3. `deploy-integration.yml` runs the suite against a prebuilt image (`image`, `<registry/name>@sha256:<digest>`) from a
   release workflow (a tag push is accepted then), with `fail-on-flaky` and the expected origins handed to the suite.
4. An app keeps its existing history: `--notes-ref` and `--ref-prefix` name the notes ref and the branch prefix
   (defaults `refs/notes/integration` and `integration/`), on the CLI and as workflow inputs.

## Context

Issue #308 (labels `enhancement`, `pkg: deploy`, `adoption`). Follow-up to #248. Work comes from GitHub issues; the
PR closes the issue. #309 and #310 change the same package in parallel: all three share the unreleased version 0.1.8,
and the second to merge folds into the existing CHANGELOG section.

## Constraints

- Scope: `tools/deploy/src/integration`, `tools/deploy/src/cli` (integration command, usage), the package's README,
  CHANGELOG and `examples/integration.yml`, `.github/workflows/deploy-integration.yml`,
  `tests/repo/deploy-workflows.test.ts`, the version pins of the three reusable deploy workflows.
- Today's behaviour stays the default: a call without the new flags or inputs behaves as before.
- A note without flaky tests stays readable by the 0.1.7 CLI (no new key is written then).
- The suite job keeps no credential that can write; the registry login for the image is gone before the app's code runs.
- Workflow shell stays within bash 3.2 and BSD/GNU-common flags (AGENTS.md). English only.

## Notes

- Research: skipped. The issue lists the four gaps and the remedies; the code they touch is the #248 change
  (`context/archive/*-deploy-integration-run/`), read in full for the plan.
- Framing: skipped; the adopter observed the gaps and the issue proposes the remedies.
- Archived 2026-10-09: all four gaps closed in 0.1.8; the release follows the merge (`auto-release.yml`).

## Decisions (auto)

- Point 4 takes the options route (`--notes-ref`, `--ref-prefix`), not a `migrate-notes` command: an app's existing
  notes may hold another format, which a copy could not convert, while pointing at the existing names keeps the app's
  refs and its new notes in one place.
- `expected-origins` accepts `http://` as well as `https://` origins: a suite on the runner may serve the image at a
  local origin.
- The image pull uses an optional `registry-token` secret instead of `packages: read` on the test job: a reusable
  job asking for a permission its caller did not grant fails every existing caller at start.
- "Expected origins" is an `expected-origins` input (https origins) handed to the set-up and suite commands as
  `INTEGRATION_EXPECTED_ORIGINS`, next to `INTEGRATION_IMAGE`; how the app maps them onto the image stays the app's.
