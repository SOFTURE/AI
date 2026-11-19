---
change_id: mcp-access-oauth-hardening
title: "mcp-access: token endpoint limit per registered client, consent page anti-framing headers, confirmation caveat"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the three low findings of the 2026-11-19 security review of `modules/mcp-access`.

## Context

Asked in chat (no issue). L1: the token endpoint keyed its counter on an unverified `client_id`, so made-up ids got a
fresh counter each (limit bypass, table growth). L2: the consent page sent no anti-framing header. L3: the README said
the assistant "cannot agree on its own", which a prompt-injected assistant can.

## Scope

- `src/server/oauth-http.ts`: look the client up first; key per address and client only for a registered one.
- `src/routes.ts`, `src/index.ts`: `OAUTH_CONSENT_PAGE_HEADERS`, `buildOAuthConsentHeaders`; the example app's
  `next.config.ts` uses it and its OAuth e2e checks the headers.
- README (consent page, confirmed calls) and CHANGELOG (Unreleased).

## Constraints

- No migration; no change of the confirmation mechanism itself.

## Notes

- Frame and research skipped: each finding names its cause and the files; the review is the research.
- Three tiny items of one package share this change (AGENTS.md: very similar tiny items may share).

## Decisions (auto)

- L2 as a `next.config` headers helper: a Next page cannot set response headers, and the module has no proxy of its
  own on that path.
- L3 as documentation: binding the yes to something only the person can do needs a channel outside the chat, which
  is the app's choice.

## Done

- On master; released with the next mcp-access release.
