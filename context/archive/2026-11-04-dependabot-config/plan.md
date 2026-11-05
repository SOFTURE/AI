# Plan: dependabot-config

## Phases

1. `.github/dependabot.yml` (`version: 2`): `npm` at `/` weekly with one group for minor and patch version updates
   and one group for security updates, `@softure-ai/*` ignored, at most 3 open pull requests; `github-actions` at `/`
   and `/.github/actions/*` weekly in one group; `docker` for the two Dockerfile folders monthly, major updates
   ignored. Every entry commits as `chore(deps)`. `tests/repo/dependabot.test.ts`: the file parses, every listed
   directory exists, every tracked Dockerfile and composite action is covered, every entry is limited and grouped.
   `AGENTS.md` (outside the managed block): how a Dependabot pull request is merged. Gates: typecheck, lint,
   repository tests.

## Decisions (auto)

- Major npm updates stay single pull requests (not grouped): a major bump is a change of its own and is never merged
  without the chain, so one pull request per package keeps it reviewable; the limit of 3 bounds the CI load.
- Docker major updates are ignored: moving the Node line (22 → 24) is a product decision (`engines.node`), not a
  routine bump; Dependabot security alerts still report a vulnerable base image.
- No custom labels: Dependabot's default `dependencies` label is enough to find its pull requests, and a label that
  does not exist would only produce a warning.
- Schedule on Monday 06:00 Europe/Warsaw, so the pull requests land at the start of the week's work.

## Progress

- [x] p1 3865ea4: `.github/dependabot.yml` (npm, GitHub Actions, Docker), `tests/repo/dependabot.test.ts` (8 passed), `AGENTS.md` "Dependabot pull requests"; typecheck, lint and language green (pre-commit), `tests/repo` 21 files green.
