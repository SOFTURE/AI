# Plan review: deploy-init-cloudflare-hooks

Reviewed plan.md against change.md, research.md and issue #310. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Major | A root-run script inside `/srv/<name>/` would let the deploy user run code as root. | Accepted in D1: root installs the script in `/usr/local/sbin`; the app folder holds only the ranges file it reads, validated line by line. |
| F2 | Major | Flushing and refilling the chain leaves it empty for a moment, which lets everyone in. | Accepted in D1: the DROP goes in first, RETURNs are inserted above it. |
| F3 | Minor | `trustedIPs` baked into the compose file goes stale when Cloudflare changes its ranges. | Accepted: the refresh hook warns on a range missing there; the ranges change rarely. |
| F4 | Minor | A refresh that fails on a Cloudflare outage must not fail a release whose firewall already has a list. | Accepted in D1: keeps the file with a warning. |
| F5 | Suggestion | `--min-length` alone does not reach apps deploying through `deploy-app.yml`. | Accepted in D4: `secret-min-lengths` input. |

No finding blocks the plan.
