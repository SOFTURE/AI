---
change_id: deploy-cloudflare-tunnel-905
status: done
---

# Plan: Cloudflare Tunnel mode (issue #905)

Input: change.md, research.md. Complexity: small to medium (one package: answers, templates, guard, docs).

## Phase 1: init --tunnel (TDD)

Files: `src/init/answers.ts`, `src/init/generate.ts`, `src/cli/init-command.ts`, the compose and deploy.sh templates,
tests.

1. Answer `tunnel` (optional boolean, `--tunnel`): refused with `edge`, `cdn`, `acmeEmail`, `www` and paths other than
   `/`, each with a message naming where it goes instead.
2. Template value `ownTraefik` (= neither edge nor tunnel) replaces `{{^edge}}` where it means the own Traefik.
3. Compose: `cloudflared` (`cloudflare/cloudflared:2026.10.1`, `tunnel --no-autoupdate run`, `TUNNEL_TOKEN:
   ${CLOUDFLARE_TUNNEL_TOKEN:?}`, `read_only`, `cap_drop: ALL`, `no-new-privileges`) on network `tunnel` only; the app
   on `tunnel` and `default`, label `traefik.enable=false`, `depends_on` cloudflared. `CLOUDFLARE_TUNNEL_TOKEN` joins
   `TEMPLATE_ENV_NAMES`.
4. init prints `next` lines: create the tunnel, public hostname to `http://app:3000`, the token secret; the app sends
   its own security headers.

## Phase 2: guard (TDD)

`checkSharedHostCompose` option `ingress: "edge" | "tunnel"` (default `edge`). With `tunnel`: no
`edge-network-missing`; new rules `edge-network-joined` (a top-level network names the edge network) and
`traefik-routing` (a service carries `traefik.enable=true` or a router, service or middleware label).

## Phase 3: docs

README (init table, flags, a "Cloudflare Tunnel" section with the steps and a `next.config` headers snippet, the guard
table), CHANGELOG `Unreleased`.

## Decisions (auto)

- `--www` and path prefixes are refused with `--tunnel`, not silently dropped: the user sets them in Cloudflare.
- No health check on `cloudflared` (distroless image); the deploy's public health wait covers it.
- Headers are documented, not generated: init does not own `next.config`.
- The Postgres loopback-port warning of `--edge` applies to `--tunnel` too: a tunnel app usually shares its host.
- `deploy.sh`'s comments now say "only with its own Traefik" instead of "not with an edge network"; the e2e app's
  `deploy.sh` is regenerated for it, its compose file is unchanged.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Gates: typecheck, lint, test
