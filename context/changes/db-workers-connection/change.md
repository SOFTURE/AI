---
change_id: db-workers-connection
title: "db: per-request Postgres connections on Workers through Hyperdrive"
status: open
roadmap_item: RP-2
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

On Workers an I/O object cannot outlive the request that opened it, so `@softure-ai/db` opens a connection per request from the Hyperdrive binding and closes it after the response, while Node keeps one shared pool. Migrations never run inside a Worker.

## Context

`getSharedDatabase` (`foundation/db/src/shared.ts`) keeps one handle per URL on `globalThis`; `createDatabase` (`client.ts`) picks node-postgres or PGlite by scheme; migrations read SQL files from disk (`migrations/files.ts`) and can be exported (`migrations/export.ts`). Hyperdrive gives a Worker a connection string to a pooled, EU-placed Postgres; node-postgres works under `nodejs_compat`.

## Constraints

- Postgres only: no D1 (roadmap decision).
- Node behaviour unchanged; PGlite stays Node-only and is refused on Workers with a clear message.
- Tests run the Workers path in workerd (Miniflare) against a local Postgres; no Cloudflare account is touched.

## Notes

- Item block: [`roadmap.md` → RP-2](../../foundation/roadmap.md).
