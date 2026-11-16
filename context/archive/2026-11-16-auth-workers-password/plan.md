# Plan: auth-workers-password (RP-3)

## Approach

Keep scrypt and its hash format. Make the default cost follow `config.platform.runtime`, resolved in `getAuthOptions`,
and declare the auth entries Workers-safe. auth 0.2.14.

## Decisions (auto)

- Workers default: N=2^14, r=8, p=5 (OWASP's 16 MiB-equivalent profile). Node default unchanged: N=2^17, r=8, p=1.
- Each unset scrypt field takes the runtime's default; an app's explicit field wins. The resolution is cached per
  options object, so `getAuthOptions` keeps returning the same object.
- No PBKDF2 format and no Web Crypto OIDC (research.md). No refusal of a high cost on Workers: documented instead.
- Declared entries: `.`, `./server`, `./proxy`; manifest `runtimes: ["node", "workers"]`.

## Phases

### Phase 1: runtime-aware default cost (TDD)
- `options.ts`: scrypt fields optional, `SCRYPT_DEFAULTS` per runtime, `ScryptParams` a full parameter set,
  `AuthOptions` with resolved scrypt; `server/options.ts`: `getAuthOptions` resolves by runtime.
- Done when: tests show the Node default, the Workers default, an explicit field winning on Workers, the same object
  on repeated calls, a login on Workers with a Node-cost hash succeeding and rehashing into the Workers cost, and the
  reverse on Node.

### Phase 2: declare and document
- `softure.workers` in package.json, manifest and module.json `runtimes`, README, CHANGELOG 0.2.14, docs/07 matrix row,
  roadmap.
- Done when: the guard passes on the entries and an `import "node:fs"` in a reachable file turns it red.

## Progress

- [x] Phase 1: runtime defaults resolved in `getAuthOptions`; 7 tests in `tests/runtime-cost.test.ts`; resolving with the Node default on every runtime turns 3 red
- [x] Phase 2: entries `.`, `./server`, `./proxy` declared; `node:fs` in `server/health.ts` turns the guard red; README, CHANGELOG 0.2.14, docs/07 row, roadmap
