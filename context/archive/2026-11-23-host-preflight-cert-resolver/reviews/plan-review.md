---
change_id: host-preflight-cert-resolver
verdict: approved
---

# Plan review

- Scope is the missing half of the comment on #1429; the network half is #1432's and stays untouched.
- No false stop for apps without Traefik routing (tunnel apps): no resolver labels, no problem, no note.
- The default inventory (`letsencrypt`) matches what `init --edge` writes, so a standard app passes.

Verdict: approved, no changes.
