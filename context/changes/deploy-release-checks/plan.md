---
change_id: deploy-release-checks
status: planned
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

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
