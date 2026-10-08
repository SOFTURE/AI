# Plan: auth-temporary-password-local-hash

## Today (master `c323892`)

- `modules/auth/src/scripts/temporary-password.ts`: `createSetTemporaryPasswordScript(config, { clock })` takes only
  `--email`. A private `createTemporaryPassword(length)` slices `randomBytes(...).toString("base64url")`; the script
  hashes it with `hashPassword(pw, options.password.scrypt)`, updates `auth.users`, revokes sessions, deletes reset
  links and returns `after.temporaryPassword` in the report, which `runOpsScript` prints.
- `modules/auth/src/server/password.ts`: `hashPassword` (exported from `/server`) writes
  `scrypt$N$r$p$salt$key`; `parseHash` throws on anything else. No non-throwing check exists.
- `@softure-ai/ops/scripts`: an `OpsScript` may list `secrets`; each such key also comes as `--<key>-file=<path>`
  (`-` reads stdin), so a secret stays out of shell history and `docker exec` argv.

## Goal

The script can set a password whose plain value never reaches the host, and both halves can use a readable alphabet.

## Key decisions

1. **`--password-hash` as a secret argument.** `secrets: ["password-hash"]` gives `--password-hash-file=-` for free.
   With it the script stores the given hash and the report carries `passwordFrom: "hash"` instead of
   `temporaryPassword`. Without it nothing changes.
2. **Validate the hash at the boundary.** A new `isPasswordHash(value)` in `password.ts` (the same rules as
   `parseHash`, without throwing; `parseHash` reuses it). The zod schema refines `password-hash` with it, so a
   malformed value is a usage error naming the argument, never echoing the value. A hash with other scrypt
   parameters than the config is accepted: login already rehashes it (`needsRehash`).
3. **`createTemporaryPassword({ alphabet?, length? })` in `src/server/temporary-password.ts`, exported from
   `/server`** next to `hashPassword` and `getAuthOptions`, which the local half needs. Characters drawn with
   `randomInt(alphabet.length)` (uniform, no modulo bias). Defaults: the base64url alphabet and 20 characters, so the
   script's default output keeps the same shape. Throws (a bug, not an expected failure) on a length below 1, an
   alphabet with fewer than 2 characters or a repeated character.
4. **`READABLE_PASSWORD_ALPHABET`** exported: `a–z` without `l`, `A–Z` without `I`/`O`, `2–9` (no `0`/`1`), no
   `-`/`_` (57 characters). The script takes it through a new option `alphabet` in `TemporaryPasswordScriptOptions`
   (an app chooses it in code, not per run). Length stays `max(minLength, 20)`.
5. **Version 0.1.9**: package.json, module.json, `src/index.ts`; README "Account recovery" gets the local-half
   example; CHANGELOG entry.

## Phases

### Phase 1: generator, hash check, script argument (TDD)

- `src/server/temporary-password.ts` (new), `src/server/password.ts` (`isPasswordHash`), `src/server/index.ts`,
  `src/scripts/temporary-password.ts`.
- Tests: generator length, alphabet membership, defaults, readable alphabet has none of `0O1lI-_`, throws on bad
  input; script with `--password-hash` sets a hash the login accepts for the locally computed password, reports
  `passwordFrom: "hash"` and no password, dry run writes nothing; `--password-hash-file=-` through `runOpsScript`
  with a stdin reader; a malformed hash is a usage error whose output does not contain the value; the `alphabet`
  option yields a password of only those characters.
- Done when: the new tests were red before the code and are green after.

### Phase 2: docs, version, gates

- README "Account recovery", CHANGELOG 0.1.9, version 0.1.9 in three places.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: generator, hash check, script argument

- [x] createTemporaryPassword and READABLE_PASSWORD_ALPHABET with tests — 9af6474
- [x] isPasswordHash and --password-hash with tests — 9af6474

### Phase 2: docs, version, gates

- [x] README, CHANGELOG, version 0.1.9 — 7d55a33
- [x] gates green — 7d55a33 (typecheck, lint, test: 343 files / 5030 tests, build)
