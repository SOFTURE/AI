---
change_id: deploy-traefik-static-trusted-ips-560
status: in_progress
---

# Plan: cloudflare-ranges reads trustedIPs from a static config file (issue #560)

Input: change.md, research.md. Complexity: small (one shell template, its tests, docs).

## Phase 1: hook option (TDD)

Files: `tools/deploy/templates/docker/prod/hooks/cloudflare-ranges.sh.tmpl`, `tools/deploy/tests/init-hook-scripts.test.ts`.

1. Tests first, running the generated hook with bash:
   - YAML block list, YAML flow list and TOML array holding every range: no warning.
   - A range missing from one entry point's list in a YAML file: the warning names the range and the file.
   - The compose-flag layout still warns as today when no option is given.
   - A path that does not exist, a file with no `trustedIPs`: one warning each, exit 0.
   - An unknown argument fails the hook.
2. The hook takes `--traefik-static-config <path>`. With it, an awk pass prints each `trustedIPs` list of the file as
   one comma-separated line; every downloaded range missing from any list is reported once. Without it, the compose
   check runs unchanged.

## Phase 2: docs

`tools/deploy/README.md` (the Cloudflare section), the hook's header comment, `tools/deploy/CHANGELOG.md`
`## Unreleased` with the migration for an app that runs a forked hook.

## Progress

- [x] Phase 1: hook option (8ec06ca; 7 new tests, 6 red before the change)
- [x] Phase 2: docs (README Cloudflare section, CHANGELOG `## Unreleased` with the migration)
