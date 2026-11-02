---
change_id: jobs-owned-status-958
title: "jobs: a signed-in user follows their own job (issue #958)"
status: in_progress
roadmap_item: null
issue: 958
branch: claude/project-thread-p0qdjg
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #958](https://github.com/SOFTURE/AI/issues/958). An app that runs AI work in the background needs a
waiting screen: the signed-in user who started a job follows its state until a result is ready. Today `getJob` is an
operator function with no notion of an owner, so every app adds its own owner column, route and polling hook. Take the
issue's proposal: an optional owner on `enqueueJob`, `getOwnJob` that answers only the owner, a Next.js route factory
(`GET` status, optional `DELETE` cancel) with the session check delegated to the app, a client hook that polls with
backoff, and a retention floor so an owned job stays readable for a while after it ends.

## Context

Labels: `enhancement`, `pkg: jobs`, `status: in progress`. Builds on #951 (progress and `requestJobCancel`, merged in
35b8fae). Jobs migration numbers: 0007 is on master, 0008 belongs to #955 (PR #969), 0009 is this change's
(agreed with the coordinator). No release in this change: the coordinator releases.

## Constraints

- jobs does not depend on auth (auth depends on jobs): the route takes a `getOwnerId` callback; the app passes its
  session lookup.
- Nothing of the payload or of an error's text reaches the user: codes, counts and an app-defined result reference.
- The owner check is part of the query, so a job of someone else is indistinguishable from a missing one.
- Migrations move forward only and say how to roll back.

## Notes

- Framing: skipped. The issue names the problem and a concrete five-part proposal.
