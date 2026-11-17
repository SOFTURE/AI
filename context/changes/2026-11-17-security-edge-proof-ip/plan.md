# Plan: security-edge-proof-ip

## Steps

1. security: `edgeProofIp({ resolver, secret, header? })` in `client-ip.ts`, exported from the root; default header
   `EDGE_PROOF_HEADER` = `x-softure-edge-proof`. `secret: undefined` returns the inner resolver unchanged (dev, test
   stacks); a secret shorter than 16 characters or an invalid header name throws; otherwise the inner resolver runs
   only when the header equals the secret (SHA-256 digests, `timingSafeEqual`), else `null`. Tests; README resolver
   table and the shared-edge note; CHANGELOG 0.3.0.
2. deploy: `init --edge` adds the middleware `<name>-edge-proof`
   (`headers.customrequestheaders.X-Softure-Edge-Proof=${EDGE_PROOF_SECRET:?}`) first in the router's middlewares,
   and `EDGE_PROOF_SECRET: ${EDGE_PROOF_SECRET:?}` to the app's environment; a `next` line names the secret and the
   resolver wrap. Generate and CLI tests.
3. deploy: `checkSharedHostCompose` rule `edge-proof-missing` for an edge app whose routing router runs no `headers`
   middleware setting the proof header (also inside a chain); option `edgeProofHeader` (string, default
   `X-Softure-Edge-Proof`, or `false` to skip). Tests; README rule table and Edge network section; CHANGELOG 0.8.0.

## Progress

- [ ] 1 security resolver.
- [ ] 2 init --edge.
- [ ] 3 guard rule.

## Decisions (auto)

- The secret is required as its own Environment secret (`${EDGE_PROOF_SECRET:?}`) rather than derived from another
  one in the deploy action: the compose file stays the one list of secrets, and no workflow changes.
- The guard is on by default with an opt-out: the issue asks it to flag a shared-edge app without the proof.
- One fixed default header name for both packages, overridable on both sides.
