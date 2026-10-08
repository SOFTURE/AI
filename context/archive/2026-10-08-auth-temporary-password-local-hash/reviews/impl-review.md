# Implementation review: auth-temporary-password-local-hash

Reviewed: the branch diff against master `c323892` (`modules/auth`), against plan.md and issue #244. Mode: autonomous
(findings decided by the reviewer, accepted fixes applied in the same change).

## Plan conformance

| Point of #244 | Plan decision | Delivered |
| --- | --- | --- |
| 1. Take a precomputed hash, with an exported generator and the hash function for the local half | `--password-hash` as a secret argument, `isPasswordHash` at the boundary, `createTemporaryPassword` in `/server` | `scripts/temporary-password.ts`, `server/password.ts`, `server/temporary-password.ts`, `server/index.ts`; tests in `temporary-password.test.ts`, `password.test.ts` |
| 2. Optional readable alphabet | `READABLE_PASSWORD_ALPHABET`, script option `alphabet` | same files; tests in `temporary-password.test.ts` |
| Dry run and before/after report unchanged | default path untouched | existing script tests pass unchanged |

One drift, accepted: `isPasswordHash` is exported from `/server` too (the plan kept it internal). The local half can
check its own output before piping it, and the function is the one the script uses, so they cannot disagree.

Every new test was seen red before the code (9 of 14 in `temporary-password.test.ts` failed on master's script).

## Findings

### 1. Warning: the password choice was typed as two independent optionals

- **Evidence:** the first version computed `temporaryPassword` and `passwordHash` as `string | undefined` each; the
  compiler accepted `set({ passwordHash: undefined })`, which drizzle would skip silently.
- **Impact:** none today (the branches were exclusive by construction), but a later edit could store no hash.
- **Fix:** `choosePassword` returns a discriminated union (`from: "hash" | "drawn"`). **Decision:** fixed.

### 2. Suggestion: `isPasswordHash` does not check that N is a power of two

- **Evidence:** it mirrors `parseHash`, which checks positive integers only; `scrypt` throws on another N at login.
- **Impact:** an operator who builds a hash by hand with a wrong N gets an account whose login fails; with
  `hashPassword` (the documented path) N comes from the config, which the module already validates.
- **Decision:** kept as is (plan-review finding 4: the two checks must stay identical).

### 3. Suggestion: report shape differs by mode

- **Evidence:** `after` carries `temporaryPassword` for a drawn password and `passwordFrom: "hash"` for a given one.
- **Decision:** kept: the drawn report is unchanged for existing callers, and the hash report states where the
  password came from without carrying anything secret.

## Verdict

Approve. Gates: typecheck, lint, test and build green on the final commit.
