# Research: security-workers-fetch (RP-5)

## Measured in workerd

Miniflare 4.20260730 (workerd 1.20260730.1), compatibility date 2026-07-30, `nodejs_compat`; a probe Worker called each
API the security and auth modules use:

| API | Result |
| --- | --- |
| `node:net` `BlockList` (v4 and v6 subnets), `isIP` | works, same answers as Node |
| `node:crypto` `scrypt` (N=2^14 r=8 p=5 and N=2^17 r=8 p=1), `pbkdf2` 600 000 rounds | works (the local runtime does not enforce the 128 MB isolate limit) |
| `node:crypto` `createPublicKey` (PEM and JWK), `sign`, `verify` | works |
| `node:zlib` `createGunzip` stream | works |
| `node:http` `request` with `lookup` | throws `ERR_OPTION_NOT_IMPLEMENTED: The options.lookup option is not implemented` |
| `node:http` `request` to a 302 | status 302 with `Location`, not followed |
| `node:http` `request` to a gzip body | body still gzip, `content-encoding: gzip` kept |

Cloudflare's documentation (Node.js compatibility, 2026) lists `node:dns` (DNS-over-HTTPS), `node:net`, `node:http`,
`node:https` and the full `node:crypto` as supported, and enables `nodejs_compat` by default from compatibility date
2026-08-04.

## What it means

- The roadmap assumed `node:net`, `node:dns` and `node:http` were missing. They are not: the only gap on the guarded
  request path is the `lookup` option, which the module uses to pin DNS (`openGuardedRequest` in
  `modules/security/src/server/guarded-request.ts`). Redirect following and decoding are already done by hand, and
  workerd hands back exactly what they expect (an unfollowed 3xx, an encoded body).
- `client-ip.ts` and `public-address.ts` keep `BlockList`: no CIDR matcher is needed.
- RP-1's guard refused `net`, `dns`, `http` and `https`; it has to allow them, with the `lookup` caveat documented.
- Callers of `openGuardedRequest`: `sendGuardedRequest` and `followGuardedRedirects` (used by `fetchGuardedPage` and
  `downloadGuardedFile`). Their timers tear down the open request; a host check before the request needs an
  `AbortSignal` so the timer can stop it too.
- The security entries reach `@softure-ai/core` (Workers-safe since RP-1) and `@softure-ai/db` only through type
  imports, which the guard skips. `./jobs` reaches `@softure-ai/jobs` (RP-4) and stays out of the list.

## Other items this changes

- RP-3: `scrypt` from `node:crypto` runs on Workers, so no second hash format is needed; the open question is only the
  memory cost on a deployed isolate (128 MB), which picks the default scrypt parameters per runtime.
- RP-7: modules using `node:dns`, `node:net` or `node:http` need no rewrite for the import itself; only behaviour that
  relies on sockets (`lookup`, `agent`) or the filesystem does.
