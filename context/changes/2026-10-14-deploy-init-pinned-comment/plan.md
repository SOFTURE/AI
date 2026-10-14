---
change_id: deploy-init-pinned-comment
status: open
---

# Plan: pinned header comment of the init callers (issue #473)

Input: change.md. Complexity: small (four templates, one template value, tests, CHANGELOG).

## Phase 1: pinned and unpinned header comments (TDD)

Files: `tools/deploy/src/init/generate.ts`, `tools/deploy/src/init/generate.test.ts`,
`tools/deploy/templates/.github/workflows/{deploy,checks,release,release-notes}.yml.tmpl`, `tools/deploy/CHANGELOG.md`.

1. Tests first, for each of the four callers:
   - with `workflowsRef: <sha>`: the comment says the workflows are pinned to `<sha>`, and has neither
     "pin a commit SHA" nor `git ls-remote`;
   - without it: the comment keeps "called at `master`; pin a commit SHA";
   - every line of both renderings is at most 120 characters.
2. Add `workflowsPinned` to the template values; split each header comment into `{{#workflowsPinned}}` and
   `{{^workflowsPinned}}` blocks.
3. CHANGELOG `## Unreleased` entry (no version bump: batched releases).

## Progress

- [ ] Phase 1: pinned and unpinned header comments
