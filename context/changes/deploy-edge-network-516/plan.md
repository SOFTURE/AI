---
change_id: deploy-edge-network-516
status: in_progress
---

# Plan: init --edge and a configurable health wait (issue #516)

Input: change.md, research.md. Complexity: medium (answers, generator, three templates, the action, tests, docs).

## Phase 1: answers and the generator (TDD)

Files: `tools/deploy/src/init/{answers,generate}.ts`, `tools/deploy/src/cli/{init-command,run}.ts`,
`tools/deploy/src/init/{answers,generate}.test.ts`, `tools/deploy/tests/init-cli.test.ts`.

1. Tests first: `edge` accepts a network name and refuses a bad one, and refuses `cdn` or `acmeEmail` with it; with
   `edge` no `traefik.yml` is planned, the compose file has no `traefik` service, no `letsencrypt` volume, the app
   joins `edge` + `default`, the external network is named, labels carry the router rule, `websecure`,
   `letsencrypt`, the port and prefixed names, `www` labels only with `--www`; deploy.sh switches `app` (plus
   `worker` when present) with no traefik step; without `edge` the files stay as before except the worker word.
2. Implement: `edge` in the answers schema with the two refinements; `--edge` flag and usage line; `isIncluded` for
   `traefik.yml` is `!edge`; values `edge`, `edgeNetwork`, `switchServices`.

## Phase 2: templates

`docker-compose.yml.tmpl` (traefik service under `{{^edge}}`, labels and networks under `{{#edge}}`, conditional
`volumes:`), `deploy.sh.tmpl` (switch services, traefik step and rules check under `{{^edge}}`, header comments).

## Phase 3: the action's health wait

`.github/actions/deploy/action.yml`: inputs `health-status` (3-digit, default 200) and `health-headers` (masked lines,
written to a 0600 file in RUNNER_TEMP and passed with `-H @file`). Test the step script with a stub `curl`.

## Phase 4: docs

`tools/deploy/README.md` (init flag, edge paragraph, action inputs), `tools/deploy/CHANGELOG.md` `## Unreleased`,
the example that lists the action's inputs if any.

## Progress

- [ ] Phase 1: answers and the generator
- [ ] Phase 2: templates
- [ ] Phase 3: the action's health wait
- [ ] Phase 4: docs
