---
change_id: blog-fact-rule-value
title: "blog: fact rules read the value a pattern captures, check every year of the sentence and can warn on an unknown year (issue #379)"
status: implemented
roadmap_item: null
issue: 379
branch: claude/project-thread-im36jo
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #379](https://github.com/SOFTURE/AI/issues/379). `quality.facts` (`rules/facts.ts`, `readSentence`)
takes the first number of the whole sentence and only the first year in it, so an adopting app cannot replace its
own rule with `factRule`:

1. "Paying in 1,000 a month, you will not reach the IKE limit." reads the contribution (1,000) as the limit and
   fails the gate.
2. "The IKE limit for 2031 is 40,000." passes silently when `allowedValues(2031)` is undefined; the app's own rule
   warned that the value was not checked.

After the change a pattern can capture the value (group 1), every year named in the sentence is checked, and a rule
can ask for a warning when no year of the sentence has known values (`onUnknownYear: "warn"`, default `"skip"`).

A reviewer checks `modules/blog/tests/adoption-gaps-379.test.ts`, the README section "Fact rules" and the CHANGELOG
entry.

## Context

Issue #379 (labels `bug`, `adoption`, `pkg: blog`), filed while adopting `@softure-ai/blog` 0.1.11. No roadmap: work
comes from GitHub issues. 0.1.11 is on npm; the change goes under `## Unreleased` and rides the next release (releases
are batched by the coordinator). Issue #380 touches the same package and starts after this one merges.

## Constraints

- A rule whose patterns have no group 1 holding a number reads the value as today (first number of the sentence).
- The default `onUnknownYear` is `"skip"`, today's behaviour.
- English-only code, tests and docs.

## Notes

- Framing: skipped. The issue names the file, the function and a concrete proposal; the open choices are settled in
  plan.md.
