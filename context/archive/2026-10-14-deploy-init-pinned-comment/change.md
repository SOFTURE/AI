---
change_id: deploy-init-pinned-comment
title: "deploy: init --workflows-ref writes a pinned header comment instead of the pin-a-SHA advice (issue #473)"
status: archived
roadmap_item: null
issue: 473
branch: claude/project-thread-wzlac2
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

Close [issue #473](https://github.com/SOFTURE/AI/issues/473) (labels `bug`, `pkg: deploy`, `adoption`): with
`softure-deploy init --workflows-ref=<sha>`, the header comments of the four generated callers (`deploy.yml`,
`checks.yml`, `release.yml`, `release-notes.yml`) paste the SHA into the sentence written for the unpinned case
("called at <sha>; pin a commit SHA ...") and overflow the template's line width. Pinned callers get a comment that
says they are pinned to that commit and are moved together on an upgrade; the "pin a commit SHA" advice and the
`git ls-remote` hint stay only for callers that call `master`.

## Context

Comment-only change in `tools/deploy/templates/.github/workflows/*.tmpl`; the `uses:` lines are already right.
Releases are batched by the coordinator: the deploy CHANGELOG gets an entry under `## Unreleased`. An adopting app
that already ran `init` can keep its hand-edited comments; nothing else changes for it.

## Constraints

- Generated YAML stays equal to the examples (`examples/*.yml`), which the repository tests parse.
- Comment lines stay within 120 characters with a 40-character SHA.

## Notes

- Research: skipped. The issue names the four files, the wrong sentence and the expected text; the renderer already
  has `{{#key}}`/`{{^key}}` line sections.
- Framing: skipped. The problem is a wording bug with a stated expectation.

## Decisions (auto)

- A boolean template value `workflowsPinned` (true when `--workflows-ref` is given) selects one of two comment
  blocks; the unpinned block writes `master` literally.
- The pinned comment names the commit and says to move every caller's `uses:` to the new release tag's commit
  together when the app upgrades `@softure-ai/deploy`.
