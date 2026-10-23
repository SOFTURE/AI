---
change_id: analytics-legacy-params-689
title: "analytics: read-only legacy names of the channel parameter (issue #689)"
status: in_progress
roadmap_item: null
issue: 689
branch: claude/project-thread-d2vtk8
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #689](https://github.com/SOFTURE/AI/issues/689): `analytics({ channel: { param } })` takes one name, so
an app cannot rename its links (`?z=reddit` → `?ref=reddit`) without losing every link already shared. Add
`channel.legacyParams`: earlier names that every reader still reads (after `param`), that the package never writes,
and that the tagger and the keeper rewrite to `param` in the address bar. Let `funnel.wire.channelField` take a list
of names, so a page cached before the rename keeps sending its channel.

## Context

Labels: `enhancement`, `pkg: analytics`. No release in this change: the coordinator releases analytics in the next
combined release. The adopting app's own migration is described in the CHANGELOG and README, not done here.

## Constraints

- Without `legacyParams` (and with a single `channelField`) nothing changes.
- `param` wins when the current and a legacy name are both present.
- Links and redirects the package writes carry `param` only.

## Notes

- Framing: skipped. The issue names the problem, the API and the acceptance criteria.
