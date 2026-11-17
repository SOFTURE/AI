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

- [x] 1 security resolver (fe9f2e4): `npx vitest run modules/security` green (15 new tests in `edge-proof.test.ts`).
- [x] 2 init --edge (a168fbe): generate and init CLI tests green; the generated compose file passes the guard with
  its defaults.
- [x] 3 guard rule (a168fbe): `shared-host-compose.test.ts` green (5 new cases; the other rules' cases pass
  `edgeProofHeader: false`). `npx vitest run tools/deploy modules/security tests/repo` green, ESLint and the language
  gate clean.

## Decisions (auto)

- The secret is required as its own Environment secret (`${EDGE_PROOF_SECRET:?}`) rather than derived from another
  one in the deploy action: the compose file stays the one list of secrets, and no workflow changes.
- The guard is on by default with an opt-out: the issue asks it to flag a shared-edge app without the proof.
- One fixed default header name for both packages, overridable on both sides.
- Versions: patches (security 0.2.10, deploy 0.7.2), not minors: other packages depend on `^0.2.0` and `^0.7.0`; the
  CHANGELOGs carry `## Unreleased` until the release PR.
