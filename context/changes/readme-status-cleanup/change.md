---
change_id: readme-status-cleanup
title: "Remove stale status notes from the READMEs"
status: impl_reviewed
roadmap_item: null
branch: claude/project-thread-5303h3
created: 2026-10-07
updated: 2026-10-07
---

## Intent

The root README still says "Status: planned, implementation starting" and several package READMEs open with a
`**Status:**` line naming waves, roadmap item IDs and "prepared for its first release". Every package is on npm,
so these notes mislead a reader. Remove them and other roadmap meta from the READMEs; keep the substance
(what a package provides, installation, usage, dependencies, sister repositories).

Requested by the owner on 2026-10-07 in the project thread ("remove these status comments from the README").

## Context

- Root `README.md`: the status block and the dated roadmap pointer in the "Working on this repository" table.
- Package READMEs with a `**Status:**` header: core, db, ui, analytics, billing, mailing, ops, seo. Where the line
  carried "depends on", that part stays as a `**Depends on:**` line.
- Smaller roadmap meta: blog ("This release holds … (BL-2) …"), auth ("engagement roadmap"), waitlist ("belongs to
  the analytics roadmap"), the package template ("the CSS build arrives with `@softure-ai/ui`", which exists).

## Constraints

- Documentation only; `tools/marketing-kit/README.md` is out of scope (a parallel change, CF-2, edits it).
- `docs/` and `context/` are history and plans, not package documentation: untouched.
- Unlinked: a one-off owner request, no roadmap item.

## Process notes

- Research: skipped. The whole surface is the READMEs, found by one grep for status and roadmap wording.
- Framing: skipped. The owner named the problem and the fix; there is no competing explanation.
