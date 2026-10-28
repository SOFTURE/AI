---
change_id: auth-github-secret-names-846
title: "auth: GitHub sign-in example uses secret names GitHub Actions accepts (issue #846)"
status: archived
roadmap_item: null
issue: 846
branch: claude/project-thread-c8a3fl
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28
---

## Intent

Close [issue #846](https://github.com/SOFTURE/AI/issues/846): the GitHub sign-in example in the auth README and the
`ENV_NAME` hint of `githubProviderSchema` name `GITHUB_AUTH_CLIENT_ID` and `GITHUB_AUTH_CLIENT_SECRET`. GitHub Actions
refuses secret names that start with `GITHUB_`, so an app that copies the example cannot store them as Environment
secrets for its deploy workflow. Use `GH_AUTH_*` and say why in one sentence.

## Context

Labels: `pkg: auth`. Docs and a validation message only; no behaviour change. No release in this change: the
coordinator cuts the combined release.

## Constraints

- No code path changes; the schema still accepts any environment variable name.
- Tests keep their own env names (the issue allows it).

## Notes

- Research: skipped. The issue names the two places and the fix; a grep confirms they are the only ones outside tests.
- Framing: skipped. The problem is not in doubt.
