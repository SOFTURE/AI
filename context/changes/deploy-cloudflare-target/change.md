---
change_id: deploy-cloudflare-target
title: "deploy: a Cloudflare host target next to the VPS"
status: open
roadmap_item: RP-8
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An app set to `host: "cloudflare"` is built, migrated, deployed, verified and rolled back by `@softure-ai/deploy` the way a VPS app is today.

## Context

`tools/deploy` generates `deploy.sh`, compose files and workflows for the VPS (`init`), runs the integration suite and verifies production (`verify`). Cloudflare deploys go through `wrangler deploy` with an OpenNext build for Next.js apps; secrets go through `wrangler secret`; Hyperdrive, R2 and Cron Triggers are bindings in `wrangler.jsonc`.

## Constraints

- Secrets live in the GitHub Environment and are passed by name, never `secrets: inherit`.
- Tests use a fake `wrangler` binary; no call reaches Cloudflare.
- A job holding a production secret runs on `ubuntu-latest`.
- The VPS target is unchanged.

## Notes

- Item block: [`roadmap.md` → RP-8](../../foundation/roadmap.md).
