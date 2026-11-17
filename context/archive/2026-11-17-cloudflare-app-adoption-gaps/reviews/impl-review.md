# Implementation review: cloudflare-app-adoption-gaps

- Verdict: approved.
- Diff: `backup` manifest gains `runtimes: ["node", "workers"]` (index.ts and module.json, both 0.1.2); the
  `wrangler.jsonc` template gains the `alias` block inside `{{#database}}`; two patch versions with changelog entries;
  lockfile workspace versions follow.
- Tests: the manifest guard covers every module (seen red on backup before the fix); the init test pins the alias with
  a database and its absence without one.
- Node behaviour unchanged: `runtimes` only widens what `defineSoftureConfig` accepts on Cloudflare.
