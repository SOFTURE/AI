# Research: cloudflare-app-adoption-gaps

- `foundation/core/src/manifest.ts`: `runtimes` absent means Node only; `config.ts` refuses a module without
  `workers` when `platform.host` is `cloudflare`. Every module except `backup` declares `["node", "workers"]` and lists
  `.` in `softure.workers`; `backup` lists `.` and `./server` but has no `runtimes` (checked with jq over
  `modules/*/module.json` and `package.json`).
- `backup`'s root entry imports only `@softure-ai/core` and `./server` (`checkRunsTable`), already covered by the
  Workers-entry graph test, so declaring the runtime is the whole fix.
- `foundation/db/src/next-config/index.ts` (`getCloudflareAliases`) always aliases `@electric-sql/pglite` and
  `drizzle-orm/pglite` to `dist/next-config/pglite-unavailable.js` on a Cloudflare build. The adopting app needed the
  same alias in `wrangler.jsonc` before `wrangler dev` and `wrangler deploy --dry-run` would bundle `worker.ts`.
- The template has no `alias` without a database (no `worker.ts`, OpenNext's worker is the `main`).
