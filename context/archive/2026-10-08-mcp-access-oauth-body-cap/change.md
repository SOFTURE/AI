---
change_id: mcp-access-oauth-body-cap
title: "mcp-access: cap the request bodies the OAuth handlers read (issue #255)"
status: archived
roadmap_item: null
issue: 255
branch: claude/project-thread-4u21pc
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close [issue #255](https://github.com/SOFTURE/AI/issues/255): the three OAuth handlers in
`modules/mcp-access/src/server/oauth-http.ts` read their request body with no size limit
(`request.json()` in client registration, `request.text()` in the token endpoint, `request.formData()` in the
consent decision). Registration and token are public, so anyone can push an arbitrarily large body into the app's
memory. All three read through `readSmallBody` from `@softure-ai/security` with a cap set by a new option
`oauth.maxBodyBytes` (default 16 KiB):

- too large → `413` (`invalid_request` on the JSON endpoints, an empty `413` on the consent decision);
- unreadable → the answer each handler gives today for a body it cannot read;
- the consent form keeps every encoding it accepts today (parsed through `new Response(text, { headers }).formData()`).

A reviewer checks `tests/oauth-http.test.ts` (oversized and unreadable bodies on all three handlers, a body announced
small but streamed large), `tests/module.test.ts` (the option's default and bounds), the README option table and the
CHANGELOG entry.

## Context

Issue #255, filed while an adopting app moves onto the package's OAuth HTTP layer. Work is tracked in GitHub Issues:
no roadmap item; the PR closes the issue. Released as the next mcp-access patch after 0.1.8. `analytics` and
`billing` already read their public bodies through `readSmallBody`.

## Constraints

- Default behaviour for real clients unchanged: registration bodies are hundreds of bytes, token requests under 2 KB,
  consent forms under 4 KB; 16 KiB leaves a wide margin.
- The token endpoint still counts every request in the rate limit, oversized ones included (by address, since the
  client id inside an oversized body is not read).
- English-only code and docs; no copy changes.

## Process notes

- Research: skipped as a separate file. The issue names the three call sites and the helper to use; reading
  `server/oauth-http.ts`, `security/src/read-small-body.ts`, the billing and analytics callers and
  `tests/oauth-http.test.ts` answered every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The problem is an observed unbounded read on public routes with a fix the package already uses
  elsewhere; there is no competing explanation or cheaper path.
