---
change_id: deploy-traefik-static-trusted-ips-560
---

# Research: deploy-traefik-static-trusted-ips-560

Sources: `tools/deploy/templates/docker/prod/hooks/cloudflare-ranges.sh.tmpl`, `docker-compose.yml.tmpl`,
`traefik.yml.tmpl`, `templates/deploy.json.tmpl`, `schema/deploy.schema.json`, `.github/actions/deploy/action.yml`
(release packing), `templates/docker/server/deploy.sh.tmpl` (hook runner), `tests/init-hook-scripts.test.ts`,
Traefik docs on static configuration (one source: file, flags or environment).

- The hook greps the compose file for the first `forwardedHeaders.trustedIPs=` flag and warns about each downloaded
  range missing from it. No other source is read.
- The generated `traefik.yml` is the *dynamic* file provider config (mounted as `/etc/traefik/rules.yml`); the static
  config of an app that uses a file is the app's own, at a path of its choosing. So the path must be configurable.
- The deploy action ships the whole compose folder to `/srv/<name>/` (`cp -R "$prod_dir/." "$stage/"`), so a static
  config kept next to the compose file is on the server, at a path relative to the hook's working directory.
- deploy.sh runs a host hook as `run` from deploy.json, with its arguments, in the app folder. The hook is bash and
  the server need not have Node or jq: reading a new deploy.json key from the hook would need the CLI. An argument
  in the hook's `run` array is a value from deploy.json the hook can read directly.
- Shapes the hook must read: YAML block list (`trustedIPs:` then `- "a"` lines), YAML flow list
  (`trustedIPs: ["a", "b"]`), TOML array, single- or multi-line (`trustedIPs = [ "a", "b" ]`). Traefik's static
  config can name several entry points, each with its own list. Comments start with `#`, which no CIDR contains.
- awk with POSIX classes, `sub`, `gsub` behaves the same in BSD awk, mawk and gawk.
