# Research: dependabot-config

## Findings

- No `.github/dependabot.yml` on `master`; the owner turned Dependabot on in the repository settings (2026-11-05).
- npm: one workspace at the root with one `package-lock.json`; Dependabot updates the whole workspace from `/`.
  The `@softure-ai/*` workspace packages link to each other inside the tree, and `@softure-ai/skills` is bumped by a
  change of its own (it rewrites the managed block in `AGENTS.md`), so Dependabot leaves the scope alone.
- GitHub Actions: workflows in `.github/workflows/` (all actions pinned to major tags, e.g. `actions/checkout@v7`)
  and two composite actions, `.github/actions/deploy` and `.github/actions/playwright-chromium`. Dependabot's
  `directories` accepts `/` plus a glob `/.github/actions/*`.
- Docker: two real Dockerfiles, `examples/next-app/Dockerfile` (base image in `ARG NODE_IMAGE=node:22-alpine`) and
  `tools/marketing-kit/docker/footage-worker.Dockerfile` (`FROM node:22-trixie-slim`); Dependabot's Docker
  ecosystem matches file names containing `dockerfile` in any case. The `tools/deploy/templates/*.tmpl` files are
  templates, not Dockerfiles.
- Labels: the repository has `security` and `pkg: <name>` labels, no `dependencies` label; Dependabot creates its
  default labels (`dependencies`, the ecosystem label) on its first pull request.
- Every pull request runs `ci.yml` (about 24 minutes) and `e2e.yml`; Dependabot pull requests trigger them like any
  other pull request.
- Existing repository tests parse workflow YAML with `yaml` (`tests/repo/ci-workflows.test.ts`); the same shape
  fits a test for `dependabot.yml`.
