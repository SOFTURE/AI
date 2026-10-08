---
change_id: agent-ready-0-1-1
title: "agent-ready 0.1.1: CLI commands in the README, first publish through the trusted publisher"
status: in_progress
roadmap_item: null
issue: null
branch: claude/project-thread-8enamh
created: 2026-10-08
updated: 2026-10-08
---

## Intent

`@softure-ai/agent-ready` 0.1.0 was the package's first publish, so it went to npm with `NPM_TOKEN` (a trusted
publisher can only be bound to a package that exists). Its trusted publisher (SOFTURE / AI / `release.yml`) is now
bound on npmjs.com and waits for its first publish to be validated. This change releases 0.1.1 so that publish
goes through OIDC with provenance, as every other package does.

The patch carries a small, real documentation fix: the README's installation section lists the package entries
but not the `agent-ready` CLI the package installs (`bin`), whose commands are only mentioned in passing in
section 4. A reviewer checks the README table, the CHANGELOG entry and the version bump.

## Context

- `release.yml` (job `publish-npm`) already decides the auth per package: a package that is on npm publishes
  through its trusted publisher alone, `NPM_TOKEN` reaches npm only for a package npm does not know. agent-ready is
  on npm since 0.1.0, so 0.1.1 takes the OIDC path without any workflow change.
- No roadmap: issues are the tracker (project rule 2026-10-07). No issue: the release was asked for directly.

## Constraints

- No code change; only README, CHANGELOG and the version (`release:version`: package.json, module.json, the inline
  manifest in `src/index.ts`, the lockfile).
- Release after the merge with auto-release (`agent-ready`), on the owner's request in the thread.

## Process notes

- Research and framing: skipped. The only question (which auth the release takes) is answered by reading
  `release.yml`, recorded above; the scope is a documentation patch and a version bump.
