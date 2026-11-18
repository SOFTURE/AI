---
change_id: ci-usage-report
title: "A weekly and on-demand report of the CI minutes each project, workflow and job uses"
status: planned
roadmap_item: null
issue: 1360
branch: claude/project-thread-xvy7o9
created: 2026-11-18
updated: 2026-11-18
archived_at: null
---

## Intent

The owner and the agents that work on a project can see, every week and whenever they ask, how many CI minutes the
project used and which workflows and jobs used them: on GitHub-hosted runners and on Ubicloud runners alike, with the
estimated cost of each, so a resource-hungry pipeline is found from data instead of from the bill. An app gets the
report by calling one reusable workflow from SOFTURE/AI with a few lines and bumping its version later; an agent reads
the result as JSON (and as a Markdown table) without opening the GitHub billing pages.

## Context

The owner's request (2026-11-18, project thread), translated from Polish (the language gate keeps Polish out of the
repository; the original is in the project thread):

> My apps use a lot of Actions minutes. Some run on Ubicloud, some on GitHub Actions. I would like a pipeline that
> makes weekly reports, or on demand, and checks how many Actions minutes a given project used, so that I can see which
> pipeline used how many minutes and judge how resource-hungry a project is in terms of minutes. Work out how to
> approach it; I would make it a separate package, or a separate workflow, or you may wire it into the workflows we
> already have in the projects, so that later I bump it and have the pipeline available, can check the usage
> periodically through GitHub Actions, and have access to it directly from an agent, to know how resource-hungry a
> topic is. Open a change, research it, verify it and prepare the change. Tell me whether you would put it in a
> separate package or can merge it thematically into an existing package of ours.

The coordinator's brief: research and a change record first, no implementation; a new package is the owner's
decision, so present the options with a recommendation and wait for the owner's choice before planning.

Earlier CI work in this repository: the 2026-11-04 optimisation (PRs #1043, #1046: the macOS workflow, area-gated
jobs, four test shards, a narrow pre-push).

## Constraints

- English only in the product (code, report text, workflow inputs). The owner can override the report's wording only
  through a message dictionary, as in every other package.
- No adopting app's repository is changed by this work: the README, the example caller and the release notes say
  what an app adds.
- The reporting workflow itself must stay cheap: one job of a few minutes on the caller's runner, no matrix.
- Read-only towards GitHub and Ubicloud: the report never cancels, reruns or changes a workflow, a runner or a setting.
- No secret is logged; a token missing a permission degrades the report (marked as partial), it does not fail it.

## Notes

- Placement: unlinked (`roadmap_item: null`); the project works from the issue queue. Issue #1360.
- Owner decision (2026-11-18, decision card): a new package `@softure-ai/ci-usage`.
- Frame skipped: the problem is stated by the owner with its measurement (minutes per project, workflow and job); the
  open point is where the code lives, which the research answers.
