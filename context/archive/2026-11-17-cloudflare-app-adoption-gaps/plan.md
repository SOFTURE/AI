# Plan: cloudflare-app-adoption-gaps

## Phases

1. backup runtime: `runtimes: ["node", "workers"]` in `modules/backup/src/index.ts` and `module.json`, version 0.1.2,
   changelog; a repository test that ties every manifest's workers runtime to `softure.workers` (seen red on backup
   before the fix). Evidence: `npx vitest run tests/repo/workers-entries.test.ts modules/backup`.
2. Template alias: the `alias` block under `{{#database}}` in `wrangler.jsonc.tmpl`, version 0.7.3, changelog; the
   init test expects it with a database and its absence without. Evidence: `npx vitest run tools/deploy`.

## Acceptance

- Gates green (typecheck, lint, tests); CI green on the pull request.
- After merge: `auto-release` for `backup deploy`; the adopting app builds with `backup()` on Cloudflare.

## Decisions (auto)

- One change for both: both are what one app met adopting the Cloudflare path, each a few lines.
- The alias path assumes the app's own `node_modules` (as `withDatabaseBuild` resolves from the app's folder).

## Progress

- [x] p1 backup runtime: d011c11; the new manifest test red on `@softure-ai/backup` without the fix, green with it;
      `npx vitest run tests/repo/workers-entries.test.ts tests/repo/packages.test.ts modules/backup` green
- [x] p2 template alias: d011c11; `npx vitest run tools/deploy/tests/init-cloudflare.test.ts` green; the same alias
      measured in the adopting app: `wrangler deploy --dry-run` bundles `worker.ts` with it
