---
change_id: connections-module-634
title: "New module @softure-ai/connections: outbound OAuth 2.0 client and API-key credentials (issue #634)"
status: archived
roadmap_item: null
issue: 634
branch: claude/project-thread-po7vb8
created: 2026-10-21
updated: 2026-10-21
archived_at: 2026-10-21
---

## Intent

Close [issue #634](https://github.com/SOFTURE/AI/issues/634): an adopting app that acts on behalf of the owner's own
accounts in other SaaS products needs to be an OAuth **client** of their APIs (the opposite of `@softure-ai/mcp-access`,
which is a server). Ship a module that does the fragile parts once: the authorization code flow with `state` and PKCE,
encrypted storage of tokens and API keys, refresh under a lock with a terminal "reconnect required" state, an
admin-only connections page, a hook when a connection needs reconnecting, a privacy contributor and a fake provider
for tests.

## Context

Labels: `enhancement`, `new package`. The owner asked for the whole module at once, nothing deferred. Released with
the coordinator's batch; the first npm publish of a new package needs the owner's `NPM_TOKEN` (docs/02 §12), then a
trusted publisher.

## Constraints

- Plaintext tokens and keys never reach the database, a log line, an error code or the browser.
- A refresh never runs twice for one connection at the same time, across processes.
- `invalid_grant` is terminal (`connections.reconnect_required`); network, 5xx, 429 and odd answers are retryable.
- No provider-specific API clients (out of scope); the app calls the API with the token.
- Module standard (docs/02): own Postgres schema, forward-only SQL, `en` messages only, tokens-only styling, twelve
  README sections, module.json equal to the manifest.

## Notes

- Framing: skipped. The issue names the problem and the ask in detail.
- #635 (`requestJson` writes) is not a dependency in code: token endpoints take a form-encoded body, not JSON, so the
  module has its own token client with the same guarantees (timeout, no redirects, codes that never quote a URL).
  The README points to `requestJson` for calling provider APIs with the token.

## Before the next release

- `@softure-ai/connections` 0.1.0 is new on npm: its first publish needs the `NPM_TOKEN` repository secret, then a
  trusted publisher (`SOFTURE` / `AI` / `release.yml`) on the package's npm settings
  ([scripts/release/README.md](../../../scripts/release/README.md), "First release of a new package").
