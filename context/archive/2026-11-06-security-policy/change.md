---
change_id: security-policy
title: "docs(security): repository security policy (SECURITY.md)"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-i4r8jr
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

The repository has no security policy, so GitHub offers its placeholder template (made-up version lines such as
5.1.x and 4.0.x). The outcome: a real `SECURITY.md` at the root that says which `@softure-ai/*` versions get fixes,
how to report a vulnerability privately, what response to expect, and how dependency and code alerts are handled.

## Context

Owner request in the project chat (2026-11-06 07:23 UTC): set up the security policy for the project. Coordinator
brief: supported versions from the real npm packages, reporting through GitHub private vulnerability reporting,
response expectations, Dependabot and the hourly security alert sync.

## Constraints

- English only. No version numbers that go stale with every release: the policy is stated per version line.
- Nothing in the policy may route a private report into a public issue.

## Notes

- Framing: skipped. The request names the file and its sections.

## Done

- `SECURITY.md` at the root: support for the latest minor of each published `@softure-ai/*` package, private
  reporting through GitHub, response times, coordinated disclosure, provenance, Dependabot and the hourly alert sync.
- README `## Security` links it.
- Owner step: turn on private vulnerability reporting (Settings → Code security → Private vulnerability reporting);
  the session's GitHub tools cannot change that setting.
