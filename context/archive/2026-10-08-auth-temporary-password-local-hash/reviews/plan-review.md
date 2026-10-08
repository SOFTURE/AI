# Plan review: auth-temporary-password-local-hash

Reviewed: plan.md against change.md, issue #244 and the code on master `c323892` (`modules/auth`,
`modules/ops/src/scripts/ops-script.ts`). Mode: autonomous (findings decided by the reviewer, fixes applied to
plan.md).

## Findings

### 1. Warning: the script cannot see how strong the hashed password is

- **Evidence:** with `--password-hash` the script only receives `scrypt$N$r$p$salt$key`; the length rule
  (`max(minLength, 20)`) applies to passwords the script generates.
- **Impact:** an operator could hash a short password locally and the script would store it.
- **Fix:** none possible from a hash. The README example builds the local half with `createTemporaryPassword` and
  `length: Math.max(minLength, 20)`, and says the rule is the caller's with a precomputed hash.
  **Decision:** accepted as a documented limit; Phase 2 covers it in the README.

### 2. Warning: an inline `--password-hash` lands in shell history and `docker exec` argv

- **Evidence:** `runOpsScript` reads `--<key>-file` only for keys listed in `secrets`.
- **Impact:** a scrypt hash is not the password, but it can be attacked offline.
- **Fix:** `secrets: ["password-hash"]` (already in decision 1) and the README shows `--password-hash-file=-` with
  the hash piped over ssh. **Decision:** accepted.

### 3. Warning: a malformed hash must not be echoed

- **Evidence:** `formatIssue` prints `--<path>: <issue.message>`; the message is the schema's own text, so it is
  safe only if the refine message is a constant.
- **Fix:** the refine message is a constant ("is not a scrypt hash written by @softure-ai/auth"); Phase 1 tests that
  the usage output does not contain the given value. **Decision:** accepted.

### 4. Suggestion: should `isPasswordHash` also check the base64url characters?

- **Evidence:** `parseHash` checks the scheme, positive integer parameters and non-empty salt and key, not their
  characters; stored hashes from an adoption go through it at every login.
- **Decision:** rejected. `isPasswordHash` keeps exactly `parseHash`'s rules so the two can never disagree (a hash the
  script accepts is one login can read), and tightening `parseHash` could throw on stored hashes at login.

### 5. Suggestion: a hash with other scrypt parameters than the config

- **Decision:** accepted as planned (decision 2): login rehashes it with the configured cost (`needsRehash`), the same
  path as any older hash.

## Verdict

Ready to implement with findings 1–3 reflected in Phases 1 and 2 (already in plan.md).
