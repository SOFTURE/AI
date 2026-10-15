# Implementation review: host-package

Reviewed: branch `claude/project-thread-xj9lf0` against plan.md, plus SOFTURE/VPS_FOUNDATION#1. Mode: full.
Verdict: ready, once SOFTURE/VPS_FOUNDATION#1 is merged (its merge releases the pinned 1.25.0).
Findings: 0 critical, 1 warning, 3 notes.

## Coverage
| Ask of #524 | Where |
| --- | --- |
| `softure-host server`, idempotent, `--check` | `src/cli/server-command.ts`, `ansible/server.yml`; tests: vars, command lines, check flags, failure exit |
| Built on `softure.vps_foundation`, not re-implemented | `ansible/requirements.yml` (git tag pin), `server.yml` imports `vps_bootstrap` |
| `traefik_edge`, `cloudflare_origin`, deploy user with forced-command keys, upstream | SOFTURE/VPS_FOUNDATION#1 (three roles) |
| `app add`: folder, first `deploy.sh`, key line | `ansible/app.yml`; `e2e/converge.sh` |
| Environment with `v*` tag policy before reading secrets; passwords only when missing; values on stdin | `src/cli/github-step.ts`, `src/github/gh.ts`; tests in `cli.test.ts`, `github.test.ts` |
| Known hosts from the server's own key over the admin connection | `src/ssh/host-keys.ts` (`ssh -o BatchMode=yes … cat /etc/ssh/ssh_host_*_key.pub`) |
| Cloudflare DNS, TLS Full (strict) check, Access create or reconcile, never delete foreign apps | `src/cloudflare/onboard.ts`; tests in `cloudflare.test.ts` |
| Every shared name a parameter with a generic default; existing edge with `manage: false` | `src/inventory/schema.ts`; tests in `inventory.test.ts` |
| List the compose file's required names the Environment lacks | `findRequiredNames` + the last step of `app add` |
| Tested with a throwaway container in CI | CI job `host-ansible` → `e2e/converge.sh` |

## Evidence
- `npm run typecheck`, `npm run lint`, `npm run build`: green. `npx vitest run tools/host tests/repo`: green.
- `e2e/converge.sh` against `ubuntu:24.04` with the role branch: first run `changed=7`, second `changed=0`; one
  key line; a real `ssh deploy@…` with the CLI-issued key prints `deploy.sh ran: status` through the forced
  command; a replaced `deploy.sh` is kept; rotation refuses the old key and accepts the new one; a run without a
  key on an app without a line stops and names `--rotate-key`.
- The issued private key loads in OpenSSH (`ssh` login above) and in Python `cryptography`, and signs for its
  public half; its fingerprint matches an independent computation.
- `npm run release:pack -- --all --dry-run`: `@softure-ai/host@0.1.0` packs with `ansible/`; the packed CLI
  finds its playbooks and requirements from `dist/`.
- VPS_FOUNDATION roles: `ansible-lint` production profile, 0 findings; `deploy_user` and `traefik_edge` converged
  twice (second run `changed=0`), `traefik_edge` served a label-routed container over HTTPS; the firewall and refresh
  scripts ran on a Docker host (rules applied twice without duplicates).

## Adversarial read
- Lockout: `system_hardening` writes the admin key exclusively and turns `vps_ssh_allowed_users` into `AllowUsers`.
  `server` passes `[adminUser, deployUser]` (test) and the README warns that `adminPublicKey` must be the key the
  admin logs in with.
- Jinja in values: no free text reaches Ansible. Slugs, hosts, users and names are regex-bound by the schema;
  `deploy.sh` goes as a file path (`copy: src`), never as a templated variable; the e-mail is validated.
- A secret on a command line or in output: values only on `gh` stdin (test asserts no value in any argument or in
  printed text). The key pair never touches disk; the temporary folder holds only `deploy.sh` and is removed.
- A half-done run: the server line is written before GitHub's secret; a run that stops between them leaves GitHub
  without `DEPLOY_SSH_KEY`, so the next run issues a key again and replaces the line. Nothing is left inconsistent.
- Dry run: no `-X`, `secret set` or `variable set` call (test), Ansible in check mode, Cloudflare GETs only (tests).

## Findings
1. WARN, ordering. `ansible/requirements.yml` pins 1.25.0, which exists only after SOFTURE/VPS_FOUNDATION#1
   merges; until then the `host-ansible` job fails at the collection install. Merge that PR first.
2. Note. `server.yml` was syntax-checked but not converged: the bootstrap needs a VM with systemd, UFW and sshd
   restarts, which a container does not give. The edge roles were converged on their own.
3. Note. The first npm publish of `@softure-ai/host` needs the `NPM_TOKEN` secret and then a trusted publisher
   (scripts/release/README.md §First release of a new package).
4. Note. `softure-deploy init --cdn=cloudflare` still generates per-app firewall units; teaching it to skip them on a
   host with `cloudflare_origin` (and `--edge`) belongs to #516, which this change does not touch.
