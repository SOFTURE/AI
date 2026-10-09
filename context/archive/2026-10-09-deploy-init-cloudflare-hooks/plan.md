# Plan: deploy-init-cloudflare-hooks

Input: change.md, research.md. Complexity: medium (three independent parts, one package).

## Goal

`@softure-ai/deploy` 0.1.8: `init --cdn=cloudflare`, the ESM-safe Dockerfile, `hooks/lib.sh` and
`env render --min-length`, documented and tested.

## Key decisions

- **D1 `--cdn=cloudflare`** (an `InitAnswers.cdn` enum with one value) adds:
  - `docker/prod/hooks/cloudflare-ranges.sh`: fetches both lists, refuses a malformed or empty list (and `/0`),
    writes `cloudflare-ips.txt` in the app folder only when it changed; a failed download keeps an existing file
    (warning) and fails only when there is none; warns when a range is missing from the compose file's
    `trustedIPs`.
  - `deploy.json` hooks: `post-up` `cloudflare-ranges` and `maintain` `cloudflare-ranges-daily`, both
    `["bash", "hooks/cloudflare-ranges.sh"]`.
  - `docker/server/cloudflare-only.sh`, `.service`, `.path`, installed once by root (README steps): a chain
    `SOFTURE-CLOUDFLARE` with a RETURN per range and a final DROP, filled DROP-first so a refill never opens the
    origin; jumped to from `DOCKER-USER` for TCP whose original destination port is 80 or 443 on the external
    interface (default route, `CLOUDFLARE_ONLY_INTERFACE` overrides). IPv6 uses `DOCKER-USER` when Docker manages
    ip6tables, else INPUT. The `.path` unit re-runs it when the ranges file changes; the service also runs after
    Docker starts.
  - Traefik `forwardedHeaders.trustedIPs` on both entry points from the ranges the package ships
    (`CLOUDFLARE_RANGES`); `proxyProtocol` is left out (Spectrum only).
  - init prints a `next` line: install the root files, set `DEPLOY_ORIGIN_IP` for `verify --origin`.
- **D2 Dockerfile.** Both esbuild runs get `--alias:server-only=./.esbuild/empty.mjs` (written in the same RUN) and
  `--banner:js=` with `createRequire`.
- **D3 `hooks/lib.sh`** always written (`docker/prod/hooks/lib.sh`, shipped with the release): `fail`, `compose`,
  `env_value NAME` (strips env render's single quotes, refuses a non-env name), `require_min_length NAME N`.
- **D4 `env render --min-length NAME=N`** (repeatable): refuses a rendered value shorter than N, naming the name and
  N only; a name the compose file does not use, or a bad spec, is a usage error. `deploy-app.yml` input
  `secret-min-lengths` (`NAME=N` separated by spaces or newlines) passes each as `--min-length`.
- **D5 Version 0.1.8**, CHANGELOG, README, `deploy-cli-version` defaults, e2e app files regenerated.

## Phase 1: tests first

- [x] generate tests: lib.sh always, Cloudflare files and hooks only with `cdn`, trustedIPs, Dockerfile flags.
- [x] script tests: cloudflare-only.sh against a recording iptables; cloudflare-ranges.sh against file:// lists;
      lib.sh helpers; an esbuild bundle with the Dockerfile's flags runs under Node.
- [x] env render `--min-length` tests; init CLI `--cdn` test.

## Phase 2: implementation

- [x] D1-D4, then D5.
- [x] Gates: typecheck, lint, tests, build.

## Progress

- 2026-10-09: phases 1 and 2 done.
