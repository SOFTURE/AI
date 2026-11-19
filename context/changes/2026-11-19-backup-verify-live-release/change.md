---
change_id: backup-verify-live-release
title: "backup: the weekly verify finds the live release's image and opens an issue when it fails (issue #1386)"
status: open
roadmap_item: null
issue: 1386
branch: claude/project-thread-ti3e7g
created: 2026-11-19
updated: 2026-11-19
---

## Intent

The weekly off-site backup check of an adopting app checks the backup every week, also while a release is being cut,
and a failed check reaches the owner without anyone watching the Actions tab.

## Context

Issue #1386 (labels: none at filing). `modules/backup/examples/backup-verify.yml` (backup 0.1.2) reads the migrations
from a fixed `IMAGE` tag the owner adjusts by hand; the adopting app resolved that tag from the newest published
release, which has no image until its deploy tags the digest. A failed scheduled run is mailed only to the person who
last edited the cron line. `tools/deploy/templates/cloudflare/.github/workflows/backup-verify.yml.tmpl` (written by
`softure-deploy init --host=cloudflare`) has the same silent failure; it reads migrations from the checkout, so the
image part does not apply to it.

## Constraints

- No change to an app's repository; the CHANGELOG says how to follow the example.
- Shell in the workflows stays within bash 3.2 and BSD/GNU-compatible flags.
- Tests on fakes only (fake `gh` and `docker` on `PATH`).

## Notes

- Research kept short: the change is two workflow files, their docs and tests; the facts are in `research.md`.
