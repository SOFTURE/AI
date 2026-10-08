# Plan: auth-exact-hash-check

Input: change.md (research skipped, framing inline in D1; reasons there). Complexity: small (one phase, one
package).

## Goal

`isPasswordHash(value)` is true only for a value `hashPassword` could have written: scheme `scrypt`, cost a power
of two above 1, positive integer block size and parallelization, a base64url salt of exactly 22 characters
(16 bytes) and a base64url key of exactly 86 characters (64 bytes). `set-temporary-password --password-hash`
therefore refuses a truncated or padded hash as a usage error. Tests, README, CHANGELOG and auth 0.1.10.

**Out of scope:** the reader used at login (`parseHash` for `matchPassword`/`needsRehash`) stays as it is (D2);
the adopting app's removal of its own local pattern.

## Findings (the reading behind the plan)

- `server/password.ts`: `readHashParts` splits on `$` and checks scheme, rest, positive safe integers and
  non-empty salt and key; `isPasswordHash` = `readHashParts !== null`; `parseHash` decodes salt and key with
  `Buffer.from(…, "base64url")`, which silently skips characters outside the alphabet and decodes a short string to
  fewer bytes. A key of 63 bytes then never equals the derived 64-byte key: every login is `mismatch`.
- `hashPassword` writes `SALT_BYTES = 16` and `KEY_BYTES = 64` as unpadded base64url: 22 and 86 characters.
- Node's `scrypt` refuses a cost that is not a power of two above 1, so a hash with such a cost throws at login
  (`deriveKey` rejects) and can never have been written by `hashPassword`.
- `scripts/temporary-password.ts`: `z.string().refine(isPasswordHash, …)` is the only check of the argument; the
  usage error has a constant message (secret-derived value never echoed). No other caller in the module.
- `tests/password.test.ts` "recognises its own hash format and nothing else" lists rejected shapes; the script's
  refusal test uses a plain string.

## Key decisions

- **D1 Tighten `isPasswordHash` itself, no second function.** The issue offers a stricter
  `isWrittenPasswordHash` beside the old one. `isPasswordHash` is documented as "the format this module writes and
  reads", has existed one release, and its only callers (the script, the operator's local half) need the exact
  answer; a lenient twin exported next to it would be the easy wrong choice. Changing the answer for damaged values
  is the fix, not a break.
- **D2 The login reader does not get stricter.** `parseHash` keeps accepting what it accepts today; a damaged
  stored hash already ends as `mismatch` there, and turning it into a thrown error at login would change an
  account's failure from "wrong password" to a server error. `readHashParts` keeps the shape check;
  `isPasswordHash` adds the exact checks on top.
- **D3 Exact lengths come from the constants.** The expected character counts are computed from `SALT_BYTES` and
  `KEY_BYTES` (`Math.ceil(bytes * 4 / 3)`), so a future change of either constant moves the check with it. The
  alphabet check is `^[A-Za-z0-9_-]+$` (no padding: `hashPassword` writes none).
- **D4 Cost: power of two above 1.** Same reason as the lengths: a hash that cannot be verified must not be
  stored.
- **D5 Docs.** README line on `isPasswordHash` says what "exact" means; CHANGELOG `0.1.10`; `package.json`,
  `module.json` (if it carries the version) and the lockfile at 0.1.10.

## Phase 1: the exact check (TDD)

- Tests (`tests/password.test.ts`): from a real `hashPassword` hash, each of these is refused: the last character
  removed, one character appended to the key, one removed from the salt, a stray `+`, `/`, `=` or `.` replacing a
  key character, padding `==` appended, a cost of 1000 and of 1; the untouched hash is accepted.
- The existing shape cases (missing part, extra part, zero cost, other scheme) are rebuilt from a real hash, so
  each fails for its own reason only (plan review F1).
- Script test (`tests/temporary-password.test.ts`): a hash cut by one character is a usage error (exit 2, constant
  message, value not echoed) and the old password still logs in.
- Code: `server/password.ts`.

Done when: the new tests were seen red on the old code, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the exact check

#### Automated
- [x] 1.1 Exact-format tests seen red, then green — 9848806
- [x] 1.2 Script refuses a truncated hash as a usage error — 9848806
- [x] 1.3 Gates green (typecheck, lint, test, build) — 9848806
- [x] 1.4 README, CHANGELOG and version 0.1.10 — 9848806
