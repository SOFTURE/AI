# Implementation review: deploy-init-cloudflare-hooks

Reviewed: the branch diff against plan.md and issue #310.

- D1: `--cdn=cloudflare` (answers enum, init flag, `next` lines); `cloudflare-only.sh` reads and validates the
  ranges before touching iptables, fills `SOFTURE-CLOUDFLARE` DROP-first, inserts each jump only when `-C` finds
  none; units point at `/usr/local/sbin/<name>-cloudflare-only` and `/srv/<name>/cloudflare-ips.txt`;
  `cloudflare-ranges.sh` writes by a rename, keeps the old file on a failed download, warns on missing
  `trustedIPs`; deploy.json hooks pass the schema; Traefik `trustedIPs` on both entry points.
- D2: both esbuild runs carry the alias and the banner; a test bundles a `server-only` module and a CJS
  dependency with the Dockerfile's own flags and runs the bundle (each flag's absence reproduced the failure).
- D3: `hooks/lib.sh` always written and shipped; helpers tested with bash against a recording docker.
- D4: `--min-length` refuses by name and length, never a value; usage errors exit 2; `secret-min-lengths` maps to
  repeated flags in `deploy-app.yml`.
- D5: 0.1.8 in `package.json`, the lockfile, the three workflow defaults and the README; CHANGELOG `## 0.1.8`;
  e2e app regenerated (`docker/prod/hooks/lib.sh`).
- Shell: bash 3.2 (no associative arrays, no `${var,,}`), `grep -o` and `cmp` as BSD and GNU both accept.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Minor | `findShortValues` skips an empty value, so an allowed-empty required name (`${NAME?}`) set to `""` passes its `--min-length`. | Kept: an empty value is "unset" for every other rule of env render; documented as "an optional name left unset is not checked". |

No finding blocks the merge.
