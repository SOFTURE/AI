# Plan: deploy-edge-network-variable

## Approach

1. `checkSharedHostCompose` gains `env?: Readonly<Record<string, string | undefined>>`; every string value of the
   parsed document is interpolated with compose's rules for `${NAME}`, `${NAME:-default}` and `${NAME-default}`
   (`$$` stays a literal dollar, `:?`/`?` forms untouched). A name `env` lacks takes its default, so init's file
   passes with no `env`, and `env: { EDGE_NETWORK: "web" }` checks it against `edgeNetwork: "web"`.
2. Template writes `${EDGE_NETWORK:-<network>}` in the label and the network name; the header comment names the
   variable. README section "Edge network" and the guard section document it.
3. `softure-host app add` sets `EDGE_NETWORK` from `inventory.edge.network` beside `APP_HOST`; README step 4.
4. CHANGELOG entries under new unreleased versions (deploy 0.8.0 or 0.7.9, host 0.1.4; decided at release).

## Decisions (auto)

- Resolve on parsed values, not on the raw text (no YAML structure change from a value).
- A bare `${NAME}` is resolved only when `env` has the name; otherwise it stays as written (it is usually `TAG`).
- `app add` sets `EDGE_NETWORK` for every app: a compose file without the variable never reads it, and `env render`
  writes only names the file uses.

## Phases

1. Guard interpolation with tests (fails before: a `${EDGE_NETWORK:-proxy}` file reports two violations).
2. Template, init tests, deploy README and CHANGELOG.
3. Host `app add` variable, its tests, README and CHANGELOG.

## Acceptance

- `npx vitest run tools/deploy tools/host` green, new tests included; `npm run typecheck`, `npm run lint` green.
- `init --edge=proxy` output contains `name: ${EDGE_NETWORK:-proxy}` and `traefik.docker.network=${EDGE_NETWORK:-proxy}`
  and passes the guard with `edgeNetwork: "proxy"` and, with `env: { EDGE_NETWORK: "web" }`, with `edgeNetwork: "web"`.
- `findComposeNames` lists `EDGE_NETWORK` as optional for that file.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
