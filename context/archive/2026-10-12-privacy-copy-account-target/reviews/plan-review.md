# Plan review: privacy-copy-account-target

Reviewed: `plan.md` against `change.md`, `research.md`, issue #376, `modules/privacy/src/server/copy-account.ts`,
`src/scripts/copy-account-script.ts`, `modules/ops/src/scripts/ops-script.ts`, `foundation/db/src/migrations/ledger.ts`.

Verdict: **approve**.

## Findings

### F1 (Warning): privacy runs on an ops that does not pass the context yet
privacy's peer range is `@softure-ai/ops ^0.1.0`; the published 0.1.9 calls `run(tx, args)`. **Decision:** step 4
refuses `--to` without a context instead of guessing; the default mode needs no context. Both ship in the next
batched release.

### F2 (Warning): two commits across two databases
With `--to`, the target transaction commits inside the ops transaction's callback; if the ops commit then fails, the
target keeps the copy. The ops transaction writes nothing in this mode, so its commit can fail only on a lost
connection after the target already committed. **Decision:** documented as the target being the only database
written; no two-phase commit.

### F3 (Suggestion): a new email equal to the old one
`--new-email` equal to the copied address is a plain copy. No plan change; the existence check covers it.

### F4 (Suggestion): ledger difference detail length
Cap the list (five entries plus a count) so a refusal stays one line. Taken in step 2.
