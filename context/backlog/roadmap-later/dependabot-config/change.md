---
change_id: dependabot-config
title: "Dependabot watches the repository's dependencies and opens grouped update pull requests"
status: backlog
roadmap_item: LT-4
branch: null
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Intent

Vulnerable or outdated dependencies of the repository are reported by Dependabot alerts and fixed by Dependabot
pull requests that run the normal gates, without flooding CI.

## Context

From [`roadmap-later.md`](../../../foundation/roadmaps/roadmap-later.md), item **LT-4** (owner, 2026-11-04): the
repository has no `.github/dependabot.yml` and no Dependabot pull requests, so nobody learns of a vulnerable
dependency until someone looks at the Security tab by hand. The repository is public, so Dependabot alerts,
security updates and secret scanning cost nothing.

Ecosystems in the tree: the npm workspace at the root (one `package-lock.json`), GitHub Actions in
`.github/workflows/` and the composite actions in `.github/actions/`, and Dockerfiles
(`examples/next-app/Dockerfile`, `tools/marketing-kit/docker/footage-worker.Dockerfile`; the
`tools/deploy/templates/*.Dockerfile.tmpl` templates are not real Dockerfiles).

## Scope

- `.github/dependabot.yml` with `version: 2` and these entries:
  - `npm` at `/`: weekly, grouped (one group for minor and patch updates, security updates in their own group),
    a small `open-pull-requests-limit`, and the labels `dependencies` and `security` where they apply;
  - `github-actions` at `/` and at each directory under `.github/actions/`: weekly, one group;
  - `docker` for the two real Dockerfiles: monthly.
- Commit messages and pull request titles that pass the language gate and the conventional commit shape
  (`commit-message.prefix: "chore(deps)"`).
- A repository test that keeps the file valid (the ecosystems and directories exist in the tree).
- A note in `AGENTS.md` (outside the managed block) on how a Dependabot pull request is merged: the coordinator
  treats it like any other green pull request, without the full change chain for a patch or minor bump with
  green gates.

## Prerequisites

The owner at the keyboard, in Settings → Code security of SOFTURE/AI:

- turn on **Dependabot alerts** and **Dependabot security updates**;
- check that **Secret scanning** and **Push protection** are on (free on a public repository);
- check that CodeQL default setup stays on (it is: `dynamic/github-code-scanning/codeql`).

## Constraints

- Every Dependabot pull request runs the full CI (about 24 minutes): grouping and the pull request limit keep that
  to a few runs a week.
- No automatic merge of a major version bump: it goes through the change chain like any other change.
