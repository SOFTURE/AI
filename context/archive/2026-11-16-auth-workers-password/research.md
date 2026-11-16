# Research: auth-workers-password (RP-3)

## What runs in workerd (measured in RP-5, Miniflare 4.20260730, `nodejs_compat`)

| API | Result |
| --- | --- |
| `scrypt` N=2^17 r=8 p=1 (128 MiB) | works locally; on Cloudflare it takes the whole 128 MB isolate limit |
| `scrypt` N=2^14 r=8 p=5 (16 MiB) | works |
| `createPublicKey` (PEM, JWK), `verify` | works |
| `randomBytes`, `randomInt`, `createHash`, `timingSafeEqual` | works |

## Where the cost is read

- Every caller reads `getAuthOptions(config).password.scrypt` (login, register, change password, reset, OIDC accounts,
  ops scripts, `createTestAccount`, the example app's e2e). `getAuthOptions` has the resolved `config.platform`, while
  the options schema is parsed in `auth({ ... })` before the config exists.
- So the runtime default belongs in `getAuthOptions`: the schema leaves unset scrypt fields undefined and
  `getAuthOptions` fills them from the runtime's defaults.

## Workers-safe entries

- `.`, `./server` and `./proxy` already pass the RP-1 guard (`tests/repo/workers-entries.test.ts`): no `node:fs`,
  `node:os` or Node-only package on their import graph; an `import "node:fs"` in `server/health.ts` turns it red.
- `./next`, `./ui`, `./mailing`, `./jobs`, `./scripts`, `./testing` are not declared: `./scripts` and `./testing` run in
  Node, and the rest are left to the RP-10 example check.

## Risks

- A hash made at N=2^17 on a VPS needs 128 MiB to verify on Workers: verification there may exceed the isolate limit.
  Mitigation: document that an app moving to Workers lowers its VPS cost first (logins then rehash), or sets the Workers
  cost explicitly.
