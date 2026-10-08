# Plan review: auth-exact-hash-check

Reviewed: `plan.md` against `change.md`, issue #287, `modules/auth/src/server/password.ts`,
`src/scripts/temporary-password.ts`, `tests/password.test.ts`, `tests/temporary-password.test.ts` and every
reference to `isPasswordHash` in the repository.

Verdict: **approve with fixes applied** (one finding accepted into the plan, two recorded).

## Findings

### F1 (Warning, low effort): the existing negative list must keep passing for the same reason — accepted
`password.test.ts` rejects `"scrypt$1024$8$1$salt$key"`-style values today because of the shape check. After the
change they are rejected by the length check as well, so the old list no longer proves the shape rules (missing
part, extra part, zero cost, other scheme) on their own. **Decision:** the shape cases are rebuilt from a real
hash (real salt and key with the shape broken), so each still fails for its own reason only. Added to Phase 1.

### F2 (Suggestion): a non-canonical last base64url character still passes — accepted risk
A 22-character salt carries 4 unused bits in its last character (an 86-character key carries 2). Replacing that
character with one that differs only in those bits decodes to the same bytes, so `isPasswordHash` accepts it, but
the stored hash also verifies: no lockout, which is the failure the issue is about. Rejecting non-canonical forms
would add a decode-and-re-encode round trip for no account-level effect. **Decision:** no check; noted in the
code comment.

### F3 (Suggestion): a substituted character inside the alphabet cannot be detected — accepted risk
One base64url character replaced by another valid one keeps the length and the alphabet; only a checksum would
catch it, and the format has none. The issue's cases (cut, stray character outside the alphabet) are covered.
**Decision:** out of scope; README says the check is of the format, not an integrity check.

## Checks that passed

- No other caller: `isPasswordHash` is used only by the script's argument schema; `readHashParts` stays shared with
  `parseHash`, so login (D2) is untouched.
- Every stored hash is written by `hashPassword` (register, reset, change, rehash, the script), so the exact check
  rejects nothing a real account holds.
- The usage error keeps its constant message; the secret-derived value is never echoed (existing test).
- The lengths follow `SALT_BYTES`/`KEY_BYTES` (D3), so the constants cannot drift from the check.
- Versioning: 0.1.9 is the latest on npm; no other open change touches `modules/auth`.
