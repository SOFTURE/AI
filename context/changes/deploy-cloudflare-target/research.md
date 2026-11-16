# Research: deploy-cloudflare-target

## How the VPS target works today

- `softure-deploy init` (`tools/deploy/src/cli/init-command.ts`) reads the app's facts (`src/init/app-facts.ts`:
  `@softure-ai/db`, `@softure-ai/jobs`, `@softure-ai/ops`, the Next config), narrows the answers with
  `initAnswersSchema` (`src/init/answers.ts`; `--domain` and `--image` required) and renders `TEMPLATE_FILES`
  (`src/init/generate.ts`) through `renderTemplate` (`{{key}}`, `{{#flag}}`, `{{^flag}}` sections). Files are written
  once; `--force` replaces them.
- The caller workflow (`templates/.github/workflows/deploy.yml.tmpl`) runs `deploy-app.yml` with `deploy: false` and
  then the composite action `.github/actions/deploy/action.yml` from a job with `environment: production` on
  `ubuntu-latest`, passing every secret by name in `env:` plus `secret-names` (SOFTURE/AI#468). The action renders
  `.env.prod`, sends the release over SSH, verifies with `softure-deploy verify --config=deploy.json` and writes the
  `deploy-report` artifact (version 1: tag, environment, image, digest, jobs, serverLines) that `deploy-report.yml`
  turns into the release report.
- `tests/repo/deploy-workflows.test.ts` parses the action's YAML and runs each step's `run:` script with bash and fake
  binaries first on `PATH` (`runScript`).

## What Cloudflare needs (Cloudflare docs, read 2026-11-16)

- `wrangler.jsonc`: `main`, `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, `assets` (OpenNext writes
  `.open-next/assets`), `routes` with `custom_domain: true`, `hyperdrive: [{ binding, id }]`,
  `triggers.crons`, `vars`, `placement` (`mode: "smart"` or a hint `region: "aws:eu-central-1"`), and
  `secrets.required`, which `wrangler deploy` checks before it deploys.
- `wrangler deploy --secrets-file <json>` uploads the secrets with the code as one version; secrets not in the file are
  kept. `wrangler secret bulk` would create a deployment of the old code with the new secrets first.
- `wrangler rollback --message <text>` deploys the version before the latest without a prompt.
- `WRANGLER_OUTPUT_FILE_PATH` makes wrangler append JSON lines; the `deploy` entry carries `version_id` and `targets`.
- OpenNext (`@opennextjs/cloudflare`) builds with `opennextjs-cloudflare build` from `open-next.config.ts`
  (`defineCloudflareConfig()`); a custom worker imports `./.open-next/worker.js` and re-exports its Durable Object
  classes.

## What the packages already provide

- `@softure-ai/db/request`'s `withRequestDatabase({ url, waitUntil }, run)` (RP-2) and
  `@softure-ai/jobs/workers`' `createScheduledHandler` (RP-4): the generated `worker.ts` wraps OpenNext's `fetch` in
  the first and exports the second as `scheduled`.
- `@softure-ai/files` reaches R2 through its S3 API with credentials (`createS3Storage`), so the Worker needs no R2
  binding for files; backups to R2 are RP-9's.
- Migrations run with `runMigrateCli` (`scripts/migrate.ts`), a Node CLI: on Cloudflare it runs on the runner against
  the direct database URL (Hyperdrive pools connections and is not meant for DDL sessions).

## Risks

- The production path of every Cloudflare app: a failed verify must roll back, and secrets must never be written
  anywhere but a file under `RUNNER_TEMP` that is removed in every case.
- Flags that configure Docker, Traefik or the server make no sense on Cloudflare and must be refused, not ignored.
