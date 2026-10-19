---
change_id: deploy-shared-host-compose-guard-600
status: done
---

# Research: a compose guard for a shared edge proxy (issue #600)

- `tools/deploy/src/testing/index.ts` exports only `installFakeSsh`; the `./testing` entry is already published
  (`package.json` exports, built to `dist/testing`).
- `findComposeNames` (`src/env/required-names.ts`) reads `${VAR}` references with a regex; nothing in deploy parses
  compose YAML. `yaml@2.9.1` is in the lockfile (`modules/blog`, `tools/host` depend on it); `host` uses `parse`.
- `init --edge` (`src/init/generate.ts`, README "Edge network") writes: top-level `networks.edge: { name: <network>,
  external: true }`, labels as a list (`- "traefik.http.routers.<name>.rule=Host(...)"`), router `<name>`, middleware
  `<name>-security-headers`, `<name>-www` and `<name>-www-to-apex` with `--www`, `traefik.docker.network=<network>`,
  and with a database Postgres on `127.0.0.1:5432`.
- Compose shapes to accept: `labels` as a map or a list of `key=value`; `deploy.labels` the same; `ports` as short
  strings or long objects; `networks` on a service as a list or map; external network as `external: true` (+ `name`)
  or the legacy `external: { name }`.
- Traefik dynamic labels: `traefik.<http|tcp|udp>.<routers|middlewares|services>.<name>.<...>`. Router rule matchers
  `Host`, `HostRegexp`, `Path`, `PathPrefix`, `PathRegexp` (v3; v2 used `Path` with regex), combined with `&&`, `||`,
  `!`. A router without `rule` gets the provider's default rule `Host(<container>)`. Middlewares are referenced as
  `name` or `name@provider` in `routers.<r>.middlewares`; `chain.middlewares` nests them.
- Tests: deploy tests live under `tools/deploy/src/**` next to code and `tools/deploy/tests/`; Vitest.
