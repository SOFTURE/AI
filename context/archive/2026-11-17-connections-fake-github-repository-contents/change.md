---
change_id: connections-fake-github-repository-contents
title: "connections: the fake GitHub App serves repository contents"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-86v5mm
created: 2026-11-17
updated: 2026-11-17
archived_at: 2026-11-17
---

## Intent

Let an app that reads a user's repository with an installation token (the git data API: a branch's head, a recursive
tree, a blob, a comparison of two commits) test that reading end to end against `createFakeGithubApp`, instead of
writing its own fake of those endpoints next to the package's fake App.

## Context

Gap met by an adopting app whose end-to-end stack connects a repository through the fake App and then lists the
repository's folders: the fake answered installations and tokens but no contents. Fixed here directly and kept generic
(owner's standing order for adopting apps).

## Scope

- `FakeGithubRepositoryInput.files`, `commitFiles`, `rewriteHistory`, `calls.contents`.
- `GET /repos/{owner}/{repo}/commits/{ref}`, `/git/trees/{sha}`, `/git/blobs/{sha}`, `/compare/{base}...{head}`,
  answered only to a live installation token that reaches the repository.
- No change to the `github-app` calls; minor release 0.6.0.

## Done

- Fake, tests (3 new cases in `tests/github-app.test.ts`), README example, CHANGELOG 0.6.0.
