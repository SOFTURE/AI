# Plan: roadmap-later-promote

## Phases

1. Promote `later` (WORKFLOW §5.1): `git mv` the queued roadmap onto `roadmap.md` (the placeholder had no items),
   set `status: ready`, rewrite relative links for the new location, take both entries into `context/changes/`,
   remove the empty backlog folder, update `foundation/roadmaps/README.md` and `backlog/README.md`. Set
   `autonomy.reports.hours` to `null`. Gates: lint (language), repository tests (roadmap contract, links).

## Decisions (auto)

- LT-4 and LT-5 go from `blocked` to `ready`: their owner steps (a repository setting, a secret) do not gate the code;
  they stay as owner checks. LT-5 keeps its dependency on LT-4.
- The placeholder `roadmap.md` is replaced, not archived: it carried no items.
- `autonomy.source` stays `"issues"`, so issues still flow while the roadmap runs.

## Progress

- [x] p1: roadmap promoted, entries taken, indexes updated, reports around the clock; gates in impl-review.md.
