# Plan: deploy-cloudflare-target

## Approach

`init --host=cloudflare` picks a second file list next to the VPS one; the VPS list and its output do not change. A
new composite action `.github/actions/deploy-cloudflare/` builds, migrates, deploys with the secrets, verifies, rolls
back on a failed verify and writes the same `deploy-report` artifact, so `deploy-report.yml` and the release report
work unchanged.

## Decisions (auto)

- **A composite action, not a reusable workflow.** A reusable workflow cannot name the caller's GitHub Environment and
  `secrets: inherit` passes nothing across organizations (SOFTURE/AI#468); the action runs in the app's own job with
  `environment: production` and reads each secret by name, as the VPS action does. The roadmap's
  `deploy-cloudflare.yml` becomes this action.
- **Secrets go with the deploy (`wrangler deploy --secrets-file`), not a separate `wrangler secret bulk`.** One version
  holds code and secrets, so a rollback restores both and no deployment ever runs old code with new secrets.
- **No R2 binding in `wrangler.jsonc`.** Files talks to R2 through its S3 API; backups are RP-9.
- **Placement:** `mode: "smart"` by default, `--placement-region=<provider:region>` writes an explicit hint (for an
  EU database, e.g. `aws:eu-central-1`).
- **Hyperdrive:** `--hyperdrive-id=<32 hex>`; without it a placeholder is written and `next` names the
  `wrangler hyperdrive create` step, so a deploy fails loudly until it is set.
- **Refused with `--host=cloudflare`:** `--image`, `--edge`, `--tunnel`, `--cdn`, `--acme-email`, `--www`, `--paths`
  other than `/`, `--tables`, `--report-role`, `--worker-*`, `--data-volume`. `--env` names become the secrets the
  caller passes and `secrets.required`.
- **The generated `worker.ts`** exists when the app has a database: OpenNext's fetch inside `withRequestDatabase` on
  the Hyperdrive URL, plus `scheduled` from `createScheduledHandler` when it has jobs (cron `* * * * *`). Without a
  database `main` is `.open-next/worker.js`.
- deploy 0.7.0 → 0.7.1, not 0.8.0: agent-ready and backup accept `^0.7.0`, and a minor bump would force a release of
  both for nothing (the same call as jobs 0.1.11 in RP-4). The VPS output is byte for byte the same.
- **The tag guard lives in the action** (`tag`, `release-branch`): the checked-out commit is the tag's and is on the
  release branch, as `deploy-app.yml`'s check job holds for the VPS; that job needs a compose file, so it is not reused.

## Phase 1: init --host=cloudflare (test-after)

- `src/init/answers.ts`: `host` (`vps` | `cloudflare`), `hyperdriveId`, `placementRegion`; `image` optional with
  `host: "cloudflare"` and required otherwise; the conflicts above.
- `src/init/generate.ts`: `CLOUDFLARE_TEMPLATE_FILES` (`wrangler.jsonc`, `open-next.config.ts`, `worker.ts`,
  `scripts/migrate.ts`, the caller `deploy.yml`, `deploy.json`), chosen by `answers.host`.
- `templates/cloudflare/`: the new templates.
- `src/cli/init-command.ts`: `--host`, `--hyperdrive-id`, `--placement-region`; `--image` required only for the VPS;
  `next` lines for the Cloudflare steps; the summary names the host.
- Done when: unit tests render each file for an app with and without database and jobs, refuse every conflicting flag,
  and the VPS plan for the same answers is unchanged.

## Phase 2: the deploy-cloudflare action (test-after)

- `.github/actions/deploy-cloudflare/action.yml`: check the inputs, the secret names and the tag, build, migrate (direct URL),
  write the secrets file under `RUNNER_TEMP` (mode 600), `wrangler deploy --secrets-file`, remove it, verify, roll
  back after a failed verify, write `deploy-report.json`, upload it.
- `tests/repo/deploy-cloudflare-action.test.ts`: the action's shape (bash, no `${{` in scripts, no secrets context)
  and every step against a fake `wrangler`, `npx` and `curl`.
- Done when: the tests pass, the file is gone after a failed deploy, rollback runs only after a deploy that verified
  red.

## Phase 3: docs and release

- `tools/deploy/README.md` (a Cloudflare section), `docs/07-runtime-providers.md` (matrix row, adoption steps),
  `CHANGELOG.md`, version 0.7.1, lockfile.

## Progress

- [x] Phase 1: init --host=cloudflare (c294191; `tools/deploy/tests/init-cloudflare.test.ts`, 19 passed)
- [x] Phase 2: the deploy-cloudflare action (`tests/repo/deploy-cloudflare-action.test.ts`, 27 passed; added to macos.yml)
- [x] Phase 3: docs and release (README "On Cloudflare Workers", docs/07, CHANGELOG 0.7.1, workflow CLI defaults 0.7.1)
