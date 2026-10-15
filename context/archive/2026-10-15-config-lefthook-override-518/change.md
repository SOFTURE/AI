---
change_id: config-lefthook-override-518
title: "config: an app changes one job of the lefthook preset through a second extends file (issue #518)"
status: archived
roadmap_item: null
issue: 518
branch: claude/project-thread-hyjor3
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #518](https://github.com/SOFTURE/AI/issues/518): the README tells an app to override a job of the
lefthook preset by naming it in its own `lefthook.yml`, but lefthook merges `extends` over the main config, so the
preset's `run` wins. Document a mechanism that works, including the Next.js typecheck job
(`next typegen && tsc --noEmit`), and guard it with a test.

## Context

`@softure-ai/config` is at 0.1.2 on master; #517 (language quote marker) merged first (#526); this change sits on that master. Releases are
batched by the coordinator: no version bump, the CHANGELOG gets `## Unreleased`.

## Constraints

- The preset's jobs and their order stay as they are for an app that changes nothing.
- The mechanism is committed with the app (a teammate's checkout runs the same hooks), not a per-developer file.

## Notes

- Framing: skipped. The issue names the failure, the expected outcome and two candidate fixes.

## Decisions (auto)

- Mechanism: the app lists a file of its own after the preset in `extends` (`lefthook.app.yml` by convention).
  Measured with lefthook 2.1.16: a later `extends` file wins job by job (matched by `name`), and the jobs keep the
  preset's order. No preset split and no "copy the preset" advice: the app keeps every later preset change.
- Not `lefthook-local.yml`: it is lefthook's per-developer file, usually ignored by git.
- The README says plainly that keys a job sets in the app's `lefthook.yml` lose to the preset; only keys the preset
  does not set (such as `skip`) take effect there, which is why the old `skip: true` example worked. The examples
  move to the second file so there is one way to change a job.
- A test runs `lefthook dump` on the documented setup, so a lefthook upgrade that changes the merge order fails the
  suite instead of an app's push.
