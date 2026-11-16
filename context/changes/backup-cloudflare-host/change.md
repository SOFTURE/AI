---
change_id: backup-cloudflare-host
title: "backup: managed Postgres backed up to R2 from a scheduled workflow"
status: open
roadmap_item: RP-9
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An app on Cloudflare has the same nightly encrypted off-site backup and weekly restore check as a VPS app, without a server to run `pg_dump`.

## Context

`modules/backup` encrypts with age and uploads to R2 from the VPS `maintain` run (`node:child_process` for `pg_dump`), records runs in `backup.runs`, and has a weekly verify workflow.

## Constraints

- Write-only token for the upload, read token and private key only in the verify Environment.
- Tests on fakes only.

## Notes

- Item block: [`roadmap.md` → RP-9](../../foundation/roadmap.md).
