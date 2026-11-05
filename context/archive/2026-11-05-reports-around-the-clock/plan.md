# Plan: reports-around-the-clock

## Phases

1. Set `autonomy.reports.hours` to `null` in `context/workflow.json`. Gates: language gate, repository tests.

## Decisions (auto)

- The first draft of this branch also promoted the queued `later` roadmap; the owner corrected that (2026-11-05:
  only the report hours were asked for), so the promotion was removed before merge. LT-4 and LT-5 stay queued and
  blocked on their owner steps.

## Progress

- [x] p1: `autonomy.reports.hours` is `null`.
