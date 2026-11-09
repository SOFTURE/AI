---
change_id: backup-offsite-1210
title: "backup: encrypted off-site copies of the nightly deploy backup, with status, restore and verify (issue #1210)"
status: plan_reviewed
roadmap_item: null
issue: 1210
branch: claude/project-thread-lhasom
created: 2026-11-09
updated: 2026-11-09
archived_at: null
---

## Intent

Close [#1210](https://github.com/SOFTURE/AI/issues/1210). An app deployed with `@softure-ai/deploy` keeps its nightly
dump on the same disk as its database. After this change a new package, `@softure-ai/backup`, encrypts each new dump
(and data archive) with `age` to a public key, uploads it to any S3-compatible store with a write-only token, records
every run in a status the app can read (`getLastBackup()`, metrics through OpenTelemetry), and restores or verifies an
off-site copy with a private key that never reaches the server. `deploy.sh maintain` calls it right after its own
backup; without configuration the step is skipped and nothing else changes.

## Context

Owner decision in the issue: build on the existing nightly dump (`deploy.sh maintain`, `pg_dump -Fc`, keep 7,
`backup-data`, `verifyBackup`); no second dump, no new compose service; each app its own bucket or prefix and keys.
Several apps share one VPS on deploy 0.4.6 to 0.6.0. Labels: `enhancement`, `pkg: deploy`, new package `backup`.
Requested by the owner's coordinator with the owner's standing consent; release.owner false, so the run releases
`@softure-ai/backup` (first publication through NPM_TOKEN) and `@softure-ai/deploy`.

## Constraints

- Owns `modules/backup/` (new), `tools/deploy/templates/docker/server/deploy.sh.tmpl`,
  `tools/deploy/templates/docker/prod/docker-compose.yml.tmpl`, `tools/deploy/src/init/`, their tests, README and
  CHANGELOG of both packages, the CI job of the integration test.
- No change in any adopting app's repository.
- A missing configuration never fails or lengthens `maintain` beyond reading `.env.prod`.
- Secrets never in argv, logs, step lines or the status. The scripts stay bash 3.2-compatible.
- No test talks to an external service: unit tests use a local fake S3; the integration test runs Postgres 17 and
  MinIO in containers.

## Notes

- Framing: skipped. The issue states the problem, the owner's decision and the deliverables.
