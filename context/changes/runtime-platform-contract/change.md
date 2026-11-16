---
change_id: runtime-platform-contract
title: "core: runtime and host in the app config, with a Workers-safety guard"
status: impl_reviewed
roadmap_item: RP-1
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An app chooses where it runs in `softure.config.ts`: `platform: { runtime: "node" | "workers", host: "vps" | "cloudflare" }`. Modules declare the runtimes they support, the config refuses a mismatch at startup, and a repository guard keeps every Workers-safe entry free of Node-only APIs, so later items can make packages Workers-ready one by one and prove it.

## Context

`defineSoftureConfig` (`foundation/core/src/config.ts`) validates the config with zod and freezes it; module definitions come from `foundation/core/src/module.ts`. Measured on 2026-11-16: core's root entry imports no `node:` builtin (only `og/` and `cli/` do); db, jobs, security, files, mailing, observability, backup, ops and deploy use `node:fs`, `node:child_process`, `node:net`, `node:dns`, `node:http` or `node:os` on runtime paths. Cloudflare Workers with `nodejs_compat` provide `node:crypto`, `node:buffer`, `node:util`, `node:async_hooks`, `node:stream` and `node:path`, but no real filesystem, no child processes and no long-running process.

## Constraints

- The default is `{ runtime: "node", host: "vps" }`: every existing app config stays valid and behaves the same.
- `host: "azure"` is not added yet; the type leaves room for it.
- The guard reads which entries are Workers-safe from each package's `package.json`, not from a list in the test.
- Minor bump of core.

## Notes

- Item block: [`roadmap.md` → RP-1](../../foundation/roadmap.md).
