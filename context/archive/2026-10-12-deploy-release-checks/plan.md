---
change_id: deploy-release-checks
status: archived
---

# Plan: deploy release checks and release notes (issue #406)

Input: change.md, research.md. Complexity: medium (two workflows, two templates, tests, docs).

## Phase 1: `deploy-release-checks.yml` and `deploy-release-notes.yml` (tests first)

Files: `.github/workflows/deploy-release-{checks,notes}.yml`, `tests/repo/deploy-workflows.test.ts`.

1. Tests: both exist and fall under the shared guards (`contents: write` for `notes` only, `packages: write` for
   `build` only). Checks: the defaults; the input step accepts the defaults and refuses a bad tag, pattern, shard
   count, image, node version and command-free static/unit both off; with a tag it resolves the tag's commit and
   refuses one off the branch (a real git repository in a temp folder); the shard list for 1 and 3; `unit` is a
   matrix over it with `SHARD_INDEX`/`SHARD_COUNT`; `build` runs only after green or skipped checks and outputs the
   image by digest. Notes: refuses a bad tag and an empty body; calls `gh release edit <tag> --repo <repo>
   --notes-file <file>` with the body byte for byte.
2. Implement both workflows.

## Phase 2: callers and init

Files: `tools/deploy/examples/{checks,release-notes}.yml`, `tools/deploy/templates/.github/workflows/{checks,
release-notes}.yml.tmpl`, `src/init/generate.ts`, `src/init/generate.test.ts`, `ci.yml` (actionlint list),
`tests/init-cli.test.ts` if it lists the files.

1. Tests: the generated callers equal the examples after parsing, pin `workflowsRef`, mode 0644; the example
   callers' triggers and permissions, and that they pass only declared inputs.
2. Implement templates and examples.

## Phase 3: docs

`tools/deploy/README.md` ("Release checks" and "Edit release notes" under "Deploy workflow", the init file list,
the gating snippet), `tools/deploy/CHANGELOG.md` (`## Unreleased`).

## Progress

- [x] Phase 1: workflows and repository tests (`7a865e2`)
- [x] Phase 2: example callers, init templates (`5145e1d`)
- [x] Phase 3: docs (`74fe295`)
- [x] Implementation review: the image build split into `deploy-release-image.yml` (`2a42c92`)

Gates on the branch: `npm run typecheck`, `npm run lint`, actionlint clean; the deploy workflow, CI workflow, init
generate and init CLI tests pass; the full `npm test` runs in pre-push.
