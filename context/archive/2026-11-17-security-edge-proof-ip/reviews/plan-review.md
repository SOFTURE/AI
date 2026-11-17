# Plan review: security-edge-proof-ip

- Fail-open without a secret (Warning, accepted): `secret: undefined` keeps the inner resolver, as the issue asks for
  dev and integration stacks. Production cannot miss it: the compose file requires `EDGE_PROOF_SECRET`, and an empty
  or short value throws at startup instead of being silently skipped.
- Secret in labels (Warning, accepted): the value is in the container's labels, readable by anyone with the Docker
  socket, who owns the host anyway; a Traefik API exposed to the network would show it. Named in the README.
- Guard default-on (Warning, accepted): an app passing today fails `edge-proof-missing` after the upgrade; the
  CHANGELOG says how to add the middleware or pass `edgeProofHeader: false`. Minor bump.
- `www` router on `noop@internal` (checked): skipped by the rule, it never reaches the app.
- Verdict: approve.
