---
change_id: deploy-traefik-static-trusted-ips-560
title: "deploy: the cloudflare-ranges hook reads trustedIPs from Traefik's static config file too (issue #560)"
status: archived
roadmap_item: null
issue: 560
branch: claude/project-thread-ow7rdd
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #560](https://github.com/SOFTURE/AI/issues/560): the `cloudflare-ranges` hook that `init --cdn=cloudflare`
writes looks for Traefik's `forwardedHeaders.trustedIPs` only as compose flags. An app that keeps Traefik's static
configuration in a `traefik.yml` or `traefik.toml` file (and so cannot also pass the flags) gets a false warning on
every run, or forks the hook.

## Context

Labels: `enhancement`, `pkg: deploy`, `adoption`. deploy 0.4.1 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. Issue #561 (another thread)
also touches the deploy.json schema; this change merges first.

## Acceptance

- With the ranges listed in the static config file, the hook reports no missing range.
- A missing range is reported in both layouts (compose flags, static config file).

## Constraints

- The hook stays within bash 3.2 and tools that BSD and GNU both accept (AGENTS.md); no YAML or TOML parser on the
  server.
- Without the new setting the hook behaves exactly as today.

## Notes

- Framing: skipped. The issue names the gap, the proposal and the acceptance.

## Decisions (auto)

- The path is given in deploy.json as an argument of the hook's own `run` command
  (`["bash", "hooks/cloudflare-ranges.sh", "--traefik-static-config", "traefik.yml"]`) instead of a new
  `cdn.traefikStaticConfig` key. Reason: the hook runs on the server in bash, which cannot read deploy.json without a
  JSON parser, while its arguments already come from deploy.json; and no schema change keeps clear of #561.
- A path given but not readable, or a file without `trustedIPs`, is a warning (like every trustedIPs finding of the
  hook), never a failed release.
- In the static config file every `trustedIPs` list must hold every range (one per entry point); the compose-flag
  check stays as it is.
