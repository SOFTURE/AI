---
change_id: observability-endpoint-scheme-608
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: observability-endpoint-scheme-608

Checked the diff of `config.ts`, `start.ts`, the tests, README and CHANGELOG against change.md and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance met: `unix:`/`grpc:` endpoints are skipped with a warning; no signal left → `disabled` with the warning as reason; the other signal keeps exporting; "not a URL" still throws; the issue repro prints one warning and `isExporting false`. | No change. |
| 2 | Check | Warnings carry the source and `url.protocol` only; tests assert the host never appears. The `//` guard keeps `host:port` values (whose "scheme" is the host) on the throwing path. | No change. |
| 3 | Check | A shared `options.endpoint` skipped for both signals yields one warning (deduplicated). | No change. |
| 4 | Check | `probeObservability` needs no change: it returns `disabled` with the reason, so `softure-observability ping` under BuildKit reports why. | No change. |
| 5 | Minor | `warnings` is a new required key on an exported type; whole-object `toEqual` in an app's tests changes. | Documented in the CHANGELOG; additive for readers. |

Gates: typecheck, ESLint and the language gate clean; 93 observability tests pass (9 fail without the change).
