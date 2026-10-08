# Implementation review: auth-exact-hash-check

Reviewed: the branch diff against `plan.md` (D1-D5, Phase 1) and the plan review's accepted findings.

Verdict: **approve** (no open blocking findings; one finding fixed in the change, two recorded).

## Plan conformance

- D1: `isPasswordHash` itself is exact; no second export.
- D2: `readHashParts` and `parseHash` are unchanged, so `matchPassword` and `needsRehash` read stored hashes as
  before; the exact checks sit only in `isPasswordHash`.
- D3: lengths are `Math.ceil(bytes * 4 / 3)` of `SALT_BYTES` and `KEY_BYTES` (22 and 86); the alphabet is
  `^[A-Za-z0-9_-]+$`, no padding.
- D4: `isScryptCost` accepts a power of two above 1.
- D5: README line, CHANGELOG 0.1.10, `package.json`, `module.json`, the manifest in `src/index.ts` and the lockfile at
  0.1.10.
- Plan review F1: the shape cases are rebuilt from a real salt and key, so each fails for its own reason.

## Evidence

- The new tests were run on the old code first: `password.test.ts` "refuses a hash damaged in transport" and
  `temporary-password.test.ts` "refuses a hash cut by one character" both failed (the script exited 0 and stored
  the cut hash); with the fix both pass.
- Gates: typecheck, lint (ESLint + language gate) and build green; full `npm test` green.

## Findings

### I1 (Warning, fixed): a bitwise power-of-two test is wrong past 32 bits
The first draft used `(cost & (cost - 1)) === 0`. `&` truncates to 32 bits, so `2^32 + 2^31` passed. Replaced with
`Number.isInteger(Math.log2(cost))` and a test case for that value.

### I2 (Suggestion): numeric parts in other spellings still pass — accepted
`Number()` reads `1024.0`, `0x400` or ` 1024` as 1024, so such a hash passes. `parseHash` reads the same numbers,
so the stored hash still verifies with the password: no lockout, which is the failure this change is about.
**Decision:** no change.

### I3 (Suggestion): the plan review's F2 note — done
The doc comment of `isPasswordHash` now says that a non-canonical last character and a swapped base64url character
pass, and why that is harmless (F2) or undetectable without a checksum (F3).
