---
change_id: runtime-providers-release
title: "release the runtime-providers packages and the adoption guide"
status: archived
roadmap_item: RP-11
issue: null
branch: claude/project-thread-dufdk1
created: 2026-11-16
updated: 2026-11-16
---

## Intent

The packages changed by the roadmap are on npm, and an adopting app has one guide to move between a VPS and Cloudflare.

## Context

Releases go through the repository's release pipeline (`release.owner: false`).

## Constraints

- Every changed package bumped once, changelog per package.
- The roadmap is closed and archived before the release (WORKFLOW §5.2).

## Notes

- Item block: [`runtime-providers` → RP-11](../../foundation/archive/2026-11-16-roadmap.md).
- Frame skipped: the item only releases and documents; the audit's two gaps sit inside the unreleased deploy 0.7.1.
