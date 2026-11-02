---
change_id: billing-free-tier-962
title: "billing: a free tier without an end (issue #962)"
status: archived
archived_at: 2026-11-02
roadmap_item: null
issue: [962]
branch: claude/project-thread-ke6mjk
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #962](https://github.com/SOFTURE/AI/issues/962): model a freemium product. With
`billing({ free: { limits } })`, an account without paid access (after its trial, when one is configured) is in a new
state `free`: it keeps write access forever and is held only by the free usage limits. Read-only stays the state of an
app without a free tier.

## Context

Labels: `enhancement`, `pkg: billing`. Package: `modules/billing` 0.10.0. Checked first that no other session shipped
it: nothing on master (c9380e5) mentions #962 or a free tier, no branch or open pull request for it. Issue #964 (a
landing page) builds on this softly. No version bump: the coordinator releases the batch.

## Constraints

- Additive for an app without `free`: every state, code, SQL column and copy stays as it is.
- The SQL surface keeps its names and its existing columns; old calls keep working.
- The adopting app is not changed here; the changelog and the closing comment say what it can drop.

## Notes

- Framing: skipped. The issue names the problem, the four asks and the shape of the option.
