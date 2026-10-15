---
change_id: deploy-edge-network-516
---

# Research: deploy-edge-network-516

Sources: `tools/deploy/src/init/{answers,generate}.ts`, `tools/deploy/src/cli/{init-command,run}.ts`,
`tools/deploy/templates/docker/prod/{docker-compose.yml,traefik.yml}.tmpl`,
`tools/deploy/templates/docker/server/deploy.sh.tmpl`, `.github/actions/deploy/action.yml` (health step),
`tools/deploy/tests/server-files.test.ts`, `tools/deploy/src/init/generate.test.ts`, `tools/deploy/README.md` (init).

- Templates render with a line-based section syntax (`{{#key}}`, `{{^key}}`); booleans and strings only, so an edge
  mode is a boolean `edge` plus a string `edgeNetwork`, and the switch's service list is a computed string.
- `TEMPLATE_FILES` decides per file with `isIncluded(facts, answers)`; `traefik.yml` is `always` today.
- deploy.sh hard-codes `compose up --detach --wait --remove-orphans traefik app` (line 809) and recreates Traefik
  when `traefik.yml` changed (`rules_changed`, set in `install_release`). Its header comments name Traefik too.
- The `worker` service (issue #471) is not a dependency of `app`, so the switch above never starts or updates it.
- The compose `volumes:` section holds `letsencrypt` always and `postgres-data` with a database; without Traefik and
  without a database it would be empty, so the section itself must be conditional.
- Labels in compose: `$` must be doubled (`$${1}` in the redirect replacement); a double-quoted YAML string turns
  `\\.` into `\.`, the same as `traefik.yml` already relies on with `domainPattern`.
- The health wait is a `curl -sS -o /dev/null -w '%{http_code}'` loop that accepts only `200`; no header can be
  added. `curl -H @file` reads header lines from a file (curl 7.55+), which keeps secrets off the command line.
- `server-files.test.ts` runs the real Pack step and the generated deploy.sh with a stub docker; it can render
  edge-mode files through `planInitFiles` and assert the switch line.
