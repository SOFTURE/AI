---
change_id: metering-spend-ledger-954
title: "metering: a spend ledger and budgets for paid providers in any unit (issue #954)"
status: archived
roadmap_item: null
issue: [954]
branch: claude/project-thread-uw0c58
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #954](https://github.com/SOFTURE/AI/issues/954): an app that pays per use (speech credits, image
credits, search requests, model dollars) gets one shared ledger of paid calls and budgets that refuse a call before it
spends, safe when two jobs reserve at the same time. New package `@softure-ai/metering` 0.1.0.

## Context

Labels: `enhancement`, `pkg: llm`. Filed by the owner, who asked for the work; the coordinator confirmed a new
package is in scope (the owner's own issue), and its first publication is the coordinator's (NPM_TOKEN). Checked
first that no other session did it: nothing on master (c9380e5) mentions metering, no branch or open pull request
for it. Issues #956 and #963 build on it loosely.

## Constraints

- New folder `modules/metering/` only, plus the root README package list and the lock file.
- `@softure-ai/llm` and `@softure-ai/marketing-kit` are not changed: the adapters read their records structurally.
- No version bump beyond the new package's 0.1.0 and no publication: the coordinator releases.
- The adopting app is not changed here.

## Notes

- Framing: skipped. The issue names the problem, the API and the acceptance.
