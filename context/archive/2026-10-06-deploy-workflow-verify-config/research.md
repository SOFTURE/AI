# Research: deploy-workflow-verify-config

Date: 2026-10-06 · Sources: `.github/workflows/deploy-app.yml` (DP-2), `tools/deploy/src/cli/verify-command.ts` (DP-4),
`tools/deploy/src/init/` and `templates/` (DP-5), `tests/repo/deploy-workflows.test.ts`, actions/checkout v7
sparse-checkout, npm registry state of `@softure-ai/deploy`.

## What exists

- **The `verify` job** (`permissions: {}`, no checkout): a bash loop polls `<app-url><health-path>` every 10 s until
  it answers 200 or `verify-timeout-seconds` passes. Nothing else is checked.
- **`softure-deploy verify <url> [--config=deploy.json] [--timeout] [--concurrency]`**: reads the file relative to
  the working directory; a missing or unreadable file, invalid JSON, a schema problem or no `verify` section is exit 1
  with one line naming the file; any failed route is exit 1 after the table. It does not wait for the app to come
  up, so the health wait stays first. Requests are `GET` without credentials; the job needs no secret.
- **`softure-deploy init`** writes `deploy.json` at the app's root with a `verify` section, and the caller workflow
  without any config input; the default must therefore be `deploy.json` for an init-generated app to verify with no
  change to its caller.
- **The deploy job's pattern**: `actions/checkout@v7` at `inputs.tag`, `persist-credentials: false`,
  `sparse-checkout: <one path>`, `sparse-checkout-cone-mode: false`, then `actions/setup-node@v7` and
  `npx --yes --package=@softure-ai/deploy@<deploy-cli-version> softure-deploy …`.
- **npm**: `@softure-ai/deploy` has only `0.0.0-stage` on the registry; the workflow cannot run before DP-8, as for
  `env render` today. The pinned default (`deploy-cli-version`, tied to `tools/deploy/package.json` by the repository
  test) already contains `verify`.

## Facts the design relies on

- A non-cone sparse pattern without a leading `/` matches at any depth (gitignore rules), so `deploy.json` would
  also fetch `packages/x/deploy.json`; the pattern is anchored as `/<path>`. Only the listed path is fetched, so no
  `.npmrc` or `package.json` of the app sits in the working directory when `npx` runs.
- `actions/checkout` needs `contents: read` on the job's token; the job's permissions go from `{}` to that. The caller
  already grants it.
- An input can be empty; a job step can be skipped with `if: inputs.deploy-config != ''` without interpolating into a
  script.

## Unknown answered

**Is `deploy.json` required?** The input decides: `deploy-config` defaults to `deploy.json` (what `init` writes), so the
file is expected and its absence fails the run with the CLI's own message (a release that silently skips its checks
would read as verified). An app without a route list passes `deploy-config: ""` and keeps the health route only.
No caller exists yet (DP-8 has not published the CLI or set the tag), so the stricter default breaks nobody.
