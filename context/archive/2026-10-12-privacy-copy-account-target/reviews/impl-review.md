# Implementation review: privacy-copy-account-target

Reviewed: the diff of `modules/ops/src/scripts/`, `modules/privacy/src/server/copy-account.ts`,
`modules/privacy/src/scripts/copy-account-script.ts`, their tests, READMEs and CHANGELOGs against `plan.md`.

Verdict: **approve**.

## Findings

### F1 (Info): the rename moved from an UPDATE to the copied rows (D7)
The first cut updated `auth.users` and `privacy.consents` after verification; the consent ledger's append-only
trigger refused the update. Rewriting the copied rows before the insert keeps the ledger append-only, verifies the
renamed rows like every other row, and needs no bookkeeping of the target's own consents under the old key. The
test with the old address already in the target covers that they stay.

### F2 (Info): `--to` under an older ops
`run(tx, args, context?)` refuses `--to` without a context before it opens anything; the default mode works under
any ops. Covered by a test that calls `run` with two arguments.

### F3 (Warning): the target commits before the ops transaction
In `--to` mode the target transaction commits inside the ops callback. The ops transaction writes nothing in that
mode, so only a lost connection between the two commits could report a failure for a kept copy. Documented in the
README; accepted (plan review F2).

### F4 (Suggestion): ledger difference order
Differences list the source's ledger order first, then rows only the target has; the test pins the exact detail.
No change.

## Checks

- Plan steps 1-5 done; decisions D1-D7 hold in the code.
- No Polish outside dictionaries; reports carry no email (the script reports id, presence and row counts).
- Gates: see the PR.
