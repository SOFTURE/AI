---
change_id: deploy-verify-origin-firewall
title: "verify checks that the origin refuses direct traffic"
status: archived
roadmap_item: DF-13
branch: claude/project-thread-8ciaxz
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

An app behind a CDN (Cloudflare) keeps its server's firewall closed to everyone but the CDN. When that firewall
loosens, nothing notices today: the app still answers through the CDN. `softure-deploy verify --origin=<address>`
adds an `origin` row that passes only when a direct connection to the server's HTTPS port gets no answer, and the
deploy workflow passes the address from an `origin-address` input, so a loosened firewall fails the release.

## Context

Input: [`backlog-input.md`](backlog-input.md) (roadmap item **DF-13**, from DF-1's research §5: FIRE's
`verify-production.sh` tries `https://$DEPLOY_IP/` and only warns when it answers).

## Constraints

- Owns `tools/deploy/src/verify/`, the CLI's verify command, its tests and the `verify` part of the package README.
- `deploy-app.yml` belongs to lane A (DF-9 to DF-12 and DF-15 run in parallel): the workflow change is one optional
  input, its check and one flag on the verify step, so a merge conflict stays small; `master` wins and this branch
  merges it.
- The address is not committed: it comes from the command line (a repository variable or secret in the caller).
- No request to a real server in tests: a local listening and a local closed port.

## Process

- **Research:** skipped as a separate file. DF-1's research §5 already compared FIRE's check with the package, and
  the remaining questions (how to probe, what counts as an answer) are decided in the plan's "Decisions", from
  FIRE's script (`scripts/verify-production.sh`, lines 762-781) and the existing `tls-check.ts`.
- **Framing:** skipped. The roadmap item fixes the problem and the outcome; there is one place for the check (the
  verify engine) and no product choice left open beyond the two unknowns the plan decides.
