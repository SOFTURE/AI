---
change_id: example-on-workers
title: "example app: e2e on Workers next to Node"
status: open
roadmap_item: RP-10
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

The example app proves the abstraction: the same code runs on Node and in workerd, and only `platform` in its config differs.

## Context

`examples/` is the reference app with its e2e suite (`.github/workflows/e2e.yml`, a local fake Stripe, a Postgres service).

## Constraints

- No Cloudflare account in CI: workerd runs locally.
- The Node e2e stays as it is.

## Notes

- Item block: [`roadmap.md` → RP-10](../../foundation/roadmap.md).
