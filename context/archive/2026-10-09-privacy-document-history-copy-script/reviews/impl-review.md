# Implementation review: privacy-document-history-copy-script

Reviewed: the diff of `modules/privacy` (options, legal documents, consents, LegalDocument, `/scripts`, tests,
README, CHANGELOG, package.json, module.json) and the root `package-lock.json`, against `plan.md`.

Verdict: **approve**.

## Findings

### F1 (Warning): `ops` joins privacy's `dependsOn` as optional
The repository test requires every module package in `peerDependencies` to be named in `dependsOn`; auth and billing
name `ops` as `^0.1.0?` for the same reason. An app without ops still starts. No change.

### F2 (Suggestion): the history's dates use core's helpers
After #312 merged, the history's dates and `getDocumentVersionAt`'s day are checked with `isCalendarDay` from
`@softure-ai/core` instead of a local copy. Applied.

### F3 (Suggestion): the script's dry run and sequences
Covered by D3; README and the script's description say so. No change.

### F4 (Suggestion): tests written first
`document-history.test.ts`, the new cases in `consents.test.ts` and `legal-document.test.tsx`, and
`copy-account-script.test.ts` failed before the implementation (missing export, unknown keys, missing entry).

## Gates

`npm run typecheck`, ESLint on `modules/privacy`, `npm run lint:language`, `npx vitest run modules/privacy tests/repo`
(581 passed), `npm run build`.
