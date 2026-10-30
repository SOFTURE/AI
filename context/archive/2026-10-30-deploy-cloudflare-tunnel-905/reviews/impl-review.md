---
change_id: deploy-cloudflare-tunnel-905
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md.

- Answers: `tunnel` is an optional boolean; with it, `edge`, `cdn`, `acmeEmail`, `www` and non-`/` paths are refused
  one line each. `CLOUDFLARE_TUNNEL_TOKEN` joined `TEMPLATE_ENV_NAMES`, so `--env` cannot duplicate it.
- Templates: `ownTraefik` replaced `{{^edge}}` wherever it meant the stack's own Traefik; `tunnel: false` renders
  every file byte for byte as before (test "leaves the files without tunnel as they were"); the e2e app's compose file
  did not change.
- Compose: `cloudflared` is on `tunnel` only, read-only, no capabilities, `no-new-privileges`, pinned; the app joins
  `tunnel` and `default`, has `traefik.enable=false` and depends on the tunnel. `deploy.sh` switches `app`.
- Guard: `ingress: "tunnel"` swaps the edge rules for `edge-network-joined` and `traefik-routing`, keeps host
  ports and host network; `init --tunnel` output passes it.
- Docs: README section with the steps and a headers snippet, the guard table, CHANGELOG `Unreleased`.
- Gates: typecheck, ESLint, language gate and `npm test` green locally (ssh-keygen needed by the repository deploy tests).

Verdict: approved.
