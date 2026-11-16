# Research: runtime-providers-release

## What is left after RP-10

- **Unreleased versions on master** (no `<package>@<version>` tag): core 0.2.9, db 0.1.16, observability 0.8.6,
  testing 0.5.2, ui 0.3.9, agent-ready 0.2.3, alerts 0.2.3, analytics 0.3.5, auth 0.2.16, backup 0.1.1,
  billing 0.11.3, blog 0.5.4, connections 0.4.2, feature-switches 0.2.2, files 0.5.2, jobs 0.1.11, mailing 0.2.8,
  metering 0.4.2, ops 0.2.6, privacy 0.2.3, pwa 0.3.1, security 0.2.9, seo 0.2.3, waitlist 0.5.4, theme-kit 0.1.9,
  deploy 0.7.1. Every one was bumped by an RP item (`git log` on each `package.json`), so all of them are released.
  The path is `auto-release.yml` with `packages: all`: it tags only the missing versions and starts `release.yml`
  on each (`scripts/release/README.md`, "Release from Actions").
- **`docs/07-runtime-providers.md`** has the matrix, jobs, deploy, the example app and backups, and a short move list
  under backups. Missing: secrets, jobs and rollback during a move, the way back, observability, adding a host.

## Audit: one interface, an implementation per host

The owner's check (2026-11-16): every package exposes one interface, and the host decides only the implementation
behind it. Read across every package that has host-specific behaviour:

| Package | Common interface | Per-host implementation | Picked by |
| --- | --- | --- | --- |
| core | `defineSoftureConfig({ platform })`, module `runtimes` | `SUPPORTED_PLATFORMS` | config |
| db | `getDatabase` / request accessor, `withDatabaseBuild` | pooled handle on Node, per-request Hyperdrive handle on Workers; build externals or bundle | `platform.runtime`, `host` |
| auth | password hashing | scrypt cost per runtime, rehash on login | runtime |
| jobs | handlers, schedules, `runJobsTick` | Node worker loop, Cron Trigger `scheduled()` | the generated host entry |
| security | guarded fetch | socket `lookup` pinning on Node, pre-resolved check on Workers | runtime |
| observability | `createLogger`, service naming, `OTEL_*` | OpenTelemetry SDK on Node, `withObservability` on Workers | host entry |
| files | storage drivers | disk refused on Workers, S3 (R2) on both | config |
| ops | health route | shared checks on Node, per request on Workers | runtime |
| pwa | build version | `.next/BUILD_ID` on Node, `SOFTURE_BUILD_VERSION` on Workers | runtime |
| deploy | `init`, release, verify, report | Compose + `deploy.sh`; wrangler + `deploy-cloudflare` | `--host` |
| backup | settings, objects, `backup.runs`, restore/verify | `deploy.sh maintain`; `backup.yml` + `softure-backup run` | host |

Two gaps found, both in `@softure-ai/deploy` `init --host=cloudflare`:

1. **Observability is not wired on Cloudflare.** `registerObservability` starts nothing in a Worker (RP-10), and the
   generated `worker.ts` does not wrap the fetch with `withObservability`, so an app that moves loses its spans and
   trace ids unless it edits the generated entry by hand: the app would import a host-specific entry itself, against
   the roadmap's rule.
2. **A misleading warning.** `init` warns when `@softure-ai/db` is not in `serverExternalPackages`, also for an app
   that uses `withDatabaseBuild` (the recommended build since RP-10), and on Cloudflare it is the wrong advice: an
   external `pg` breaks the Worker's bundle.
