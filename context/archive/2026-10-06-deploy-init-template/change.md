---
change_id: deploy-init-template
title: "softure-deploy init writes an app's deploy files once"
status: archived
roadmap_item: DP-5
branch: claude/project-thread-jwect5
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

An app runs `softure-deploy init --domain=example.com --image=ghcr.io/acme/app` once and gets the deploy files it
then owns, wired to the package's commands and the reusable workflow:

- `docker/prod/docker-compose.yml` (Traefik, the app, and with a database Postgres and the one-off migrate service)
  and `docker/prod/traefik.yml` (the apex router with the app's allowed paths);
- a `Dockerfile` for a Next standalone build (the `@softure-ai/ops` container recipe);
- `docker/server/deploy.sh`, the server's forced command, which runs `backup`, `schema-guard` and `row-counts`
  (DP-3) around the switch;
- `.github/workflows/deploy.yml`, the caller of `deploy-app.yml` (DP-2);
- a `deploy.json` starter for `verify` (DP-4).

An existing file is never overwritten unless `--force` is given. A reviewer checks it with the package tests (generate
into a temp folder, exact files) and a CI job that generates the files for the example app, as a standalone app, and
builds its image from the generated `Dockerfile`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy), item **DP-5**:

> - **Outcome:** `softure-deploy init` generates files the app then owns (never overwrites without `--force`):
>   production `docker-compose.yml` and Traefik rules (apex router with the app's allowed paths); a `Dockerfile`
>   for a Next standalone build; the server `deploy.sh` that calls DP-3 and the caller workflow for DP-2; a
>   `deploy.json` starter for DP-4. A test generates into a temp folder and builds the example app's image in CI.
> - **Unknowns:** Which answers `init` asks (domain, services, migrations step) and which it reads from
>   `softure.config`.
> - **Baseline:** FIRE `docker/**`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`,
>   `docker/server/deploy.sh`. After: generated files for the example app that build.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The split (owner, 2026-10-04,
[`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md)): compose, Traefik rules, Dockerfile and
`deploy.sh` are templates generated once; the SSH gateway and the firewall belong to the server setup outside this
repository.

## Constraints

- Exclusively owns: `tools/deploy/templates/`, `tools/deploy/src/init/`, the new `init` command file in `src/cli/`
  and the CI job that builds the generated image. The shared CLI entry (`src/cli/run.ts`), the package README and
  `package.json` get small additions.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish; the package stays `private` until DP-8. No server, DNS or certificate: the CI job only
  builds the image and validates the generated files.
- FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy, item DP-5 (taken from `context/backlog/roadmap-deploy/`).
- Research: done (`research.md`), short. FIRE_TRACKER could not be read from this session (clone refused, the
  limit DP-1…DP-4 hit), so the templates come from the roadmap, the `@softure-ai/ops` container recipe (already
  verified on the example app) and DP-2…DP-4's interfaces; parity is folded into DF-1.
- Framing skipped: the owner fixed the problem and the package/template split (roadmap item and the 2026-10-04
  decision); nothing about whether to build it is in doubt.
- Gap: DF-7 (`deploy-server-files`) queued in `deploy-followups`: the workflow sends only `.env.prod`, so the
  server files are copied by hand. FIRE parity of the templates is folded into DF-1.
- Archived 2026-10-06: `@softure-ai/deploy` ships `softure-deploy init` and its templates, waiting for its first
  publish (DP-8).
