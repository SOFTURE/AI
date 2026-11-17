---
change_id: cloudflare-app-adoption-gaps
title: "backup() runs in an app on Cloudflare, and init --host=cloudflare writes the PGlite alias"
status: archived
archived_at: 2026-11-17
roadmap_item: null
issue: null
branch: claude/project-thread-7mpqei
created: 2026-11-17
updated: 2026-11-17
---

## Intent

An app on Cloudflare Workers adopts the release path of `@softure-ai/deploy` and the off-site backup without local
patches: `backup()` is accepted by `defineSoftureConfig` under `platform: { host: "cloudflare" }`, and the
`wrangler.jsonc` that `softure-deploy init --host=cloudflare` writes bundles without PGlite installed.

## Context

Both gaps were met by an adopting app moving to Cloudflare (owner, 2026-11-16: a gap any app would hit is fixed here
directly, generic, without an issue).

- `modules/backup`: `package.json` lists `.` and `./server` in `softure.workers` (RP-9), but the manifest has no
  `runtimes`, so it means Node only; the app's build fails with `module "backup" does not run on the workers runtime`.
- `tools/deploy`: the generated `worker.ts` imports `@softure-ai/db/request`, whose PGlite branch wrangler bundles;
  `withDatabaseBuild` aliases PGlite to a refusing stand-in for the Next bundle, but `wrangler.jsonc` had no alias, so
  `wrangler deploy` (and `wrangler dev`) fails in an app without PGlite.

## Scope

- `modules/backup`: `runtimes: ["node", "workers"]` in the manifest (`src/index.ts`, `module.json`); 0.1.2.
- `tests/repo/workers-entries.test.ts`: every module's manifest declares the workers runtime exactly when its package
  lists `.` in `softure.workers`.
- `tools/deploy`: `templates/cloudflare/wrangler.jsonc.tmpl` writes the `alias` for an app with a database; 0.7.2.

## Constraints

- Node behaviour unchanged; no new export, no new dependency.
- Released through `auto-release.yml` (`release.owner: false`).

## Notes

- Research kept short in `research.md`; framing skipped, both causes are measured.

## Done

- `@softure-ai/backup` 0.1.2: `backup()` runs in an app on Cloudflare Workers (manifest `runtimes`).
- `@softure-ai/deploy` 0.7.2: `init --host=cloudflare` writes the PGlite `alias` into `wrangler.jsonc`.
- Release: `auto-release` with `backup deploy` after the merge.
