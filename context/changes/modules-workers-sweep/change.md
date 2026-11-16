---
change_id: modules-workers-sweep
title: "modules: the remaining runtime modules pass the Workers guard"
status: open
roadmap_item: RP-7
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Every runtime module an app lists works on Workers or says it does not: files, mailing, mcp-access, billing, waitlist, privacy, connections, agent-ready, analytics, feature-switches, metering, alerts, seo, blog and pwa.

## Context

Measured on 2026-11-16: files uses `node:fs` and `node:stream` in the local driver and in `save.ts`; mailing uses `node:dns/promises` for DNS checks; mcp-access uses `node:module`; billing and waitlist read files with `node:fs/promises`; most others use only `node:crypto`. The S3 driver in files already speaks to R2.

## Constraints

- One module per commit, each with its Workers test.
- CLIs keep filesystem access; only request-path code changes.
- Patch or minor bumps per module as the change requires.

## Notes

- Item block: [`roadmap.md` → RP-7](../../foundation/roadmap.md).
