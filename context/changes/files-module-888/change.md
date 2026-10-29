---
change_id: files-module-888
title: "New module @softure-ai/files: stored files with hash, quota and expiry, and signed public links (issue #888)"
status: in_progress
roadmap_item: null
issue: 888
branch: claude/project-thread-1rruim
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #888](https://github.com/SOFTURE/AI/issues/888): apps that take uploads or produce media each write
their own table, folder layout, download route and cleanup. Ship a module `files` that keeps an app's files (content
hash, size, type, owner, kind, expiry, a per-owner quota) on a storage driver (local disk, S3-compatible, in memory for
tests), and hands a file to a third party by an HMAC-signed public link that expires, serves byte ranges and answers
the same `404` for every dead link.

## Context

Labels: `enhancement`, `pkg: files`. New package: version stays `0.0.0` with an `## Unreleased` section; the first
publish rides the coordinator's batch release with the existing `NPM_TOKEN`, then the owner configures a trusted
publisher. The release-tags test counts public packages and collides with PR #882 (`@softure-ai/pwa`), so master is
merged in after #882 lands.

## Constraints

- Streamed end to end: a save hashes while writing and never buffers a whole file in memory; a size cap stops it.
- A link's signature is checked before any database lookup; expired, revoked, deleted and forged links answer the
  same `404`.
- Module standard (docs/02): own Postgres schema, forward-only SQL, `en` messages only, twelve README sections,
  module.json equal to the manifest.
- No new runtime dependency: the S3 driver signs its requests (SigV4) with `node:crypto` and calls `fetch`.

## Out of scope

Uploads from clients (signed upload URLs, chunked or resumable transfer), image transforms, virus scanning, a file
browser UI (issue #888, "Out of scope").

## Notes

- Framing: skipped. The issue names the problem, the proposal and the versions.

## Before the next release

- `@softure-ai/files` is new on npm: its first publish uses the `NPM_TOKEN` repository secret, then a trusted
  publisher (`SOFTURE` / `AI` / `release.yml`) on the package's npm settings
  ([scripts/release/README.md](../../../scripts/release/README.md), "First release of a new package").
