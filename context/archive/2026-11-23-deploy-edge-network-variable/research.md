# Research: deploy-edge-network-variable

## What exists

- `tools/deploy/templates/docker/prod/docker-compose.yml.tmpl`: `{{edgeNetwork}}` in the header comment, in the
  label `traefik.docker.network={{edgeNetwork}}` and in `networks.edge.name`.
- `src/env/required-names.ts`: `${NAME:-default}` / `${NAME-default}` are optional names; `env render` writes them
  into `.env.prod` only when the deploy environment sets them. The generated `deploy.yml` passes `app-vars:
  ${{ toJSON(vars) }}`, so a `production` variable `EDGE_NETWORK` reaches `.env.prod`, and `deploy.sh` runs
  `docker compose --env-file .env.prod`, which interpolates both the label string and the network `name`. Verified
  claim of the issue: no new plumbing is needed in the workflow.
- `src/testing/shared-host-compose.ts`: parses the YAML and compares `readNetworkName(...)` and the label value with
  `options.edgeNetwork` literally, so `${EDGE_NETWORK:-proxy}` reports `edge-network-missing` and `traefik-network`.
- `tools/host/src/cli/github-step.ts` `planSecrets`: variables are only `APP_HOST`. The inventory's normalised
  `edge.network` always exists (`network ?? name`, default `softure-edge`).

## Options

- Interpolate the raw text before parsing: simple, but a value could change the YAML structure.
- Interpolate parsed string scalars (chosen): same as compose (interpolation applies to values), keys untouched.
- Only `:-` / `-` defaults are resolved; `${X:?}` and bare `${X}` stay literal unless `env` has the name (bare form),
  so the edge-proof rule still sees `${EDGE_PROOF_SECRET:?}` as non-empty.
