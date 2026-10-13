---
change_id: deploy-notes-keep-report
title: "deploy: deploy-release-notes.yml can keep the softure-deploy report sections (issue #436)"
status: planned
roadmap_item: null
issue: 436
branch: claude/project-thread-13vw5e
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #436](https://github.com/SOFTURE/AI/issues/436) (labels `enhancement`, `pkg: deploy`, `adoption`):
`deploy-release-notes.yml` replaces the whole release body, which wipes the sections `release-notes` and
`release-report` wrote between `<!-- softure-deploy:… -->` markers. A new input `keep-report` writes `body` and then
appends everything from the first `<!-- softure-deploy:` marker of the current body, unchanged. Without a marker it
behaves as today.

## Context

Follow-up to #406, which added the workflow in deploy 0.1.11. Releases are batched by the coordinator: no version bump,
the deploy CHANGELOG gets `## Unreleased`. An adopting app keeps its own notes-edit workflow until this ships.

## Constraints

- Existing callers that pass only `tag` and `body` keep today's behaviour (the reusable input defaults to `false`).
- The kept sections are copied byte for byte; nothing from the body or the release is interpolated into a script.
- Shell stays within bash 3.2 and BSD/GNU-neutral tools (AGENTS.md), since `npm test` runs the step scripts on macOS.

## Process notes

- Framing: skipped. The issue names the input, the marker and the fallback.

## Decisions (auto)

- Input name `keep-report` (boolean), the issue's first proposal.
- Reusable workflow default `false` (backward compatible); the generated caller and the example expose
  `keep-report` with default `true`, since an owner or agent editing notes almost always wants the report kept.
- With `keep-report`, a `body` that itself carries a `<!-- softure-deploy:` marker is refused: the sections would be
  doubled.
