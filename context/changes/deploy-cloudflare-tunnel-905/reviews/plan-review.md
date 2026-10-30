---
change_id: deploy-cloudflare-tunnel-905
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (01cf45f).

- Scope covers the issue's four gaps: init mode (1), the guard option (2), headers documented (3), tunnel steps (4).
- Opt-in: `ownTraefik` renders exactly as `{{^edge}}` did when `tunnel` is off; the existing "leaves the files without
  edge as they were" style test guards it, and the e2e app output does not change.
- Security: `cloudflared` does not join `default`, so it cannot reach Postgres; the token is a required secret.
- Risk: refusing `--www` may surprise; the message names the Cloudflare redirect rule.

Verdict: approved, no changes.
