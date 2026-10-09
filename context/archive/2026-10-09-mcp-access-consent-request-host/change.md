---
change_id: mcp-access-consent-request-host
title: "mcp-access: the consent decision accepts a form posted from the host it was served on (issue #294)"
status: archived
roadmap_item: null
issue: 294
branch: claude/project-thread-vyzfix
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #294](https://github.com/SOFTURE/AI/issues/294): `handleAuthorizationDecision` refuses the consent form
with `403` unless `Origin` equals the resolved app origin (`resolveAppOrigin`, else `config.appOrigin`). That is the
origin the app advertises, not necessarily the one the browser loaded the consent page from. An image built with a
fixed public `APP_ORIGIN` and run under another host (an adopting app's release pipeline runs the production image on
`http://localhost:6510`) renders the consent page, the browser posts with `Origin: http://localhost:6510`, and the
package answers `403`.

The decision accepts the form when `Origin` equals the app origin **or** when `Origin` is an http(s) origin whose host
equals the host the request was sent to (`readRequestHost`: `Host`, else the URL's host). This is the rule the
adopter's own route applied before the move to the package, and the rule Next applies to Server Actions. Every other
`Origin` (another host, `null`, missing, malformed, another scheme) is still refused with `403`.

A reviewer checks `tests/oauth-origins.test.ts` (the fixed-origin image served elsewhere completes register →
decision → token; the refusals), the README paragraph on the decision route and the CHANGELOG entry.

## Context

Issue #294, filed while an adopting app moved its OAuth decision route onto `@softure-ai/mcp-access` 0.1.10. Work is
tracked in GitHub Issues: no roadmap item; the PR closes the issue. 0.1.10 is on npm, so the change ships as 0.1.11.
The adopter keeps a workaround (it rewrites `Origin` to the app origin after its own host check) until it upgrades.

## Constraints

- Production behaviour unchanged: where the app origin and the served host agree, the same forms are accepted.
- The check stays a CSRF guard: a cross-site form must still be refused. `SameSite=Lax` on the session cookie stays
  the first layer.
- No new option. The issue's alternative (`oauth.decisionOrigins: "app" | "request"`) adds a switch whose strict
  value only breaks the case above; the request-host rule is safe on its own (see plan.md, Security).
- English-only code and docs; no copy changes.

## Process notes

- Research: skipped as a separate file. The issue names the function, the rule and the helper; reading
  `server/oauth-http.ts`, `origins.ts`, `server/origins.ts`, `next/oauth-routes.ts`, `ui/consent-form.tsx` and the
  origin tests answered every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The failure is observed with its cause and two candidate fixes from the issue; the choice is
  settled in plan.md.
