# Plan: privacy-document-history-copy-script

## Approach

1. Tests first:
   - `tests/document-history.test.ts`: a document with `history` parses, its version is the newest entry's
     (`version` or date), entries come out newest first; a declared `version` that disagrees, duplicate dates,
     an invalid date and an empty summary are refused; `{ id, version }` still parses with an empty history;
     `getDocumentVersionAt` answers by day and by instant (in the config's time zone), before the first entry is
     `undefined`, a document without history answers its version, an unknown id throws.
   - `tests/consents.test.ts`: `importConsent` without `documentVersion` stamps the version in force at `recordedAt`.
   - `tests/legal-document.test.tsx`: `document={...}` renders the version line with the newest date and the
     history newest first; `changes` given wins.
   - `tests/copy-account-script.test.ts`: dry run copies nothing, `--commit` copies, `--email` finds the account in
     the source, both or neither of `--user`/`--email` is a usage error, a missing account refuses.
2. `src/options.ts`: history entry schema, a document schema that derives `version` and sorts `history`.
3. `src/server/legal-documents.ts`: `getDocumentVersionAt`; export from `/server`.
4. `src/server/consents.ts`: `importConsent` defaults `documentVersion` to the version at `recordedAt`.
5. `src/ui/legal-document.tsx`: a third meta variant `document`.
6. `src/scripts/copy-account-script.ts` + `src/scripts/index.ts`; `./scripts` export; ops as optional peer and dev
   dependency.
7. README, CHANGELOG 0.1.11, `module.json` / package description if needed.

## Decisions (auto)

- **D1: name `createCopyAccountScript`, not `createCopyAccountCommand`.** auth, billing and waitlist name their ops
  script factories `create*Script`; the issue's name would be the only `Command`.
- **D2: the target is the app's own database, the source is `--from`.** The ops helper opens the configured
  database and runs the script in its transaction, which gives the dry run, the single commit and the report for
  free. `--from` carries a password, so it is a secret (`--from-file`). An operator copying between two other
  databases runs the script with the target's `DATABASE_URL`. No `--to` argument.
- **D3: the copy runs with `commit: true` inside the ops transaction.** The ops helper rolls a dry run back, so
  the copy is written and verified in the target, then discarded. `copyAccount` moves identity sequences past
  the copied ids, which PostgreSQL does not roll back: a dry run can leave a gap in those ids. Documented.
- **D4: version derived from the newest entry, not from today.** Parsing the config has no clock. An entry is added
  when its text takes effect; `getDocumentVersionAt(config, id, now)` answers a pre-announced change correctly.
- **D5: `importConsent` falls back to the declared version** when `recordedAt` precedes the first history entry
  (the behaviour before this change), rather than refusing an import.
- **D6: summaries are strings.** The config is plain data; an app with per-locale summaries passes `changes`.

## Progress

- [x] 1. Failing tests
- [x] 2. Options schema
- [x] 3. getDocumentVersionAt
- [x] 4. importConsent default
- [x] 5. LegalDocument document variant
- [x] 6. Copy-account script
- [x] 7. Docs, CHANGELOG
