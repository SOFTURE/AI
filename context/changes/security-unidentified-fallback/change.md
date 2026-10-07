---
change_id: security-unidentified-fallback
title: "One app image runs behind Cloudflare and in a test stack without it, with an explicit fallback"
status: implementing
roadmap_item: null
issue: "#183"
branch: claude/project-thread-6o2un5
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Intent

Close [issue #183](https://github.com/SOFTURE/AI/issues/183). An app that ships one production image
(`NODE_ENV=production`) to production behind Cloudflare and to an integration stack behind a proxy without
Cloudflare can configure `@softure-ai/security` so that both work, without a resolver that returns a made-up
address and without copying a chain that keys clients by the Cloudflare edge.

After this change:

- `security({ unidentified })` says what happens to a request no resolver identifies: `"refuse"` (the default,
  today's behaviour) or `{ key }`, one shared bucket key named by the app.
- The security README §3 documents the "same image, two stacks" case with a deploy-time switch the app reads
  (an environment variable set on the test stack only), and uses the option for local development instead of
  `() => "127.0.0.1"`.
- The README warns that behind Cloudflare and a proxy, `X-Forwarded-For` and `X-Real-IP` carry the Cloudflare
  edge address, not the client's.

## Context

The issue, reported while switching the adopting app to `@softure-ai/security@0.1.6`:

> README §3 recommends `clientIp: isProduction ? cloudflareIp() : [cloudflareIp(), …, () => "127.0.0.1"]`, keyed
> on `NODE_ENV`. The app's integration stack runs the **production image** (`NODE_ENV=production`) behind Traefik
> and without Cloudflare. With the README pattern every request there is `security.client_unidentified`, so every
> login in the integration suite is refused. The same image must work in production (Cloudflare) and in the test
> stack (no Cloudflare), so `NODE_ENV` cannot tell them apart.

> **Proposal (either):**
> 1. Document the "same image, two stacks" case with a deploy-time switch (an env var such as
>    `RATE_LIMIT_SHARED_FALLBACK=1` on the test stack only), or
> 2. Add an option `unidentified: "refuse" | { key: string }`, so the fallback is explicit config instead of a
>    fake resolver returning a made-up address.
>
> And a warning next to the dev chain: `x-forwarded-for` / `x-real-ip` behind Cloudflare plus a proxy hold the
> edge address, not the client's.

Current state: `identifyClient` (`modules/security/src/server/identify.ts`) tries `options.clientIp` in order and
returns `security.client_unidentified` when none matches; the options schema is `modules/security/src/options.ts`;
README §3 holds the `NODE_ENV` chain.

## Constraints

- Both proposals, combined: the option makes the fallback explicit, and the README documents the deploy-time
  switch that turns it on. The default stays `"refuse"`, so no app changes behaviour on upgrade.
- Touches `modules/security/` only (source, tests, README) and this change folder. Other issues run in parallel
  threads; nothing else is edited.
- No release in this change; the owner releases.

## Notes

- Placement: unlinked (`roadmap_item: null`), an adoption issue like #179, not a roadmap item.
- Research and framing are skipped: the issue names the options and the code path is one function and one schema.
