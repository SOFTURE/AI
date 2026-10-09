# Plan review: privacy-document-history-copy-script

Reviewed: `plan.md` against `change.md`, issue #325, `src/options.ts`, `src/server/legal-documents.ts`,
`src/server/consents.ts`, `src/ui/legal-document.tsx`, `src/server/copy-account.ts`,
`modules/ops/src/scripts/ops-script.ts` and `modules/auth/src/scripts/role-scripts.ts`.

Verdict: **approve**.

## Findings

### F1 (Warning): a nested `copyAccount` transaction inside the ops transaction
`copyAccount` calls `to.transaction`; on a drizzle transaction that is a savepoint, so its refusals roll back to the
savepoint and the ops transaction rolls back the rest. **Decision:** D3; the script test covers dry run and commit.

### F2 (Warning): sequences are not transactional
A dry run can advance identity sequences. **Decision:** D3, documented in the README and the script's description.

### F3 (Suggestion): keep `LegalDocumentDeclaration.version` a string
Every caller reads `.version`; the schema's output keeps it, now derived. No plan change.

### F4 (Suggestion): the time zone of an instant
`getDocumentVersionAt` with a `Date` uses `config.timezone`, the same zone the app shows its dates in. No plan change.
