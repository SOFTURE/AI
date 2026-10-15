# Plan review: host-package

Reviewed: plan.md @ 2026-10-15. Mode: full. Verdict: ready.
Findings: 0 critical, 2 warnings, 1 suggestion.
Grounding: issue #524; SOFTURE/VPS_FOUNDATION 1.24.0 (`system_hardening/tasks/users.yml`,
`templates/sshd_security.conf.j2`, `docker_engine/tasks/users.yml`, `.github/workflows/release.yml`);
`tools/deploy/templates/.github/workflows/deploy.yml.tmpl`; `tools/deploy/templates/docker/server/cloudflare-only.*`.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage of #524 | PASS: `server`, `app add`, `--check`, generic names, existing edge, collection reuse, three roles upstream; `app remove` is "later" in the issue |
| Scope | PASS: `tools/deploy` untouched (#516) |
| Risk | WARN (below) |
| Order and dependencies | WARN (below) |
| Tests | PASS: runners injected; converge in a container for the server part |

## Findings
1. WARN, lockout. `system_hardening` turns sshd `AllowUsers` into `vps_ssh_allowed_users`; without the deploy user
   in it every release fails at SSH. Resolution: `server` passes `[adminUser, deployUser]`, asserted in a test of the
   extra vars.
2. WARN, order. The package pins 1.25.0, which exists only after the VPS_FOUNDATION PR merges (its merge is its
   release). The `host-ansible` CI job is red until then. Resolution: the VPS_FOUNDATION PR is merged first (it is
   additive: three new roles, nothing existing changes), then this branch's CI re-runs.
3. Suggestion. Keep `vps_bootstrap`'s exclusive `authorized_keys` for the admin user in mind: `adminPublicKey` must
   be the key the owner logs in with, or `server` locks them out. The README says so next to the field.
