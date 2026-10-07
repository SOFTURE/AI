---
change_id: charts-followups-close
title: "Close the charts-followups roadmap without promoting another"
status: archived
roadmap_item: null
branch: claude/project-thread-749waj
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Every item of the main roadmap `charts-followups` is merged and released (CF-1, MK-12, CF-2). Archive it the way
earlier roadmaps were closed (`softure-roadmap --close`, WORKFLOW §5.2), but promote no queued roadmap in its place:
work now runs on GitHub Issues until further notice, one issue per change.

## Context

- `context/foundation/roadmap.md` (charts-followups): CF-1 still reads `done_code` waiting on `@softure-ai/charts`
  0.1.1, which is on npm (`npm view @softure-ai/charts versions` lists 0.1.1 and 0.1.2); MK-12 and CF-2 are `done`.
- The two open owner checks (trusted publisher of charts, the charts 0.1.1 release) are both settled: 0.1.1 went out
  through the trusted publisher.
- `context/backlog/roadmap-charts-followups/` holds only its README (CF-1 was taken).
- `tests/repo/roadmap-contract.test.ts` reads `context/foundation/roadmap.md` and expects it plus at least one queued
  roadmap; the relative-link test checks every `*.md`.

## Constraints

- Documentation only (`context/`, `README.md`); no package changes, no release.
- `roadmap-later` stays queued and is not promoted.

## Process notes

- Research: skipped. The whole surface is the roadmap, its backlog folder and the files linking to them, found by
  one grep for `charts-followups` and `foundation/roadmap.md`.
- Framing: skipped. The problem and the outcome are set (close, do not promote); the only open question, how to
  represent "no active roadmap", is a plan decision.
