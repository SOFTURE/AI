# Plan: mailing-history-import

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases).

## Today (master `88fc13c`)

- `mailing.deliveries` (migration `0002`, `0003`): key `(scope, recipient_key)`, where the key is the base64url
  SHA-256 of the trimmed, lowercased address (`getRecipientKey`). `CHECK ((status = 'sent') = (provider_message_id IS
  NOT NULL))`, so a `sent` row needs a provider message id; `rejected` needs a `reason` from four codes; `kind` is
  required; `campaign_id` references `mailing.campaigns`. Nothing writes a row except `deliverOnce`.
- `deliverOnce` claims through `INSERT … ON CONFLICT DO UPDATE … WHERE status = 'pending' OR stale claim`; a closed
  row (`sent`/`rejected`) answers `done` whatever its `campaign_id`. `planCampaign` matches by `scope` only. So a
  row with `scope = 'campaign:<id>'` and no `campaign_id` is honoured by both.
- `maxAttempts` is a per-call option of `deliverOnce` (default `DEFAULT_MAX_ATTEMPTS = 5`); `sendCampaign` passes its
  options through; there is no module option and no way to say "never give up".
- `softure-mail campaign <content-file> --recipients <file>` reads both from disk; the content file's `html:` resolves
  next to it. The CLI opens `database.handle`, else its own connection on `database.url`.

## Goal

`@softure-ai/mailing` 0.1.9 (shared with issue #211) with all three points.

**Out of scope:** importing suppressions (already `suppressRecipient`), importing campaign rows (content is unknown for
history; a later `sendCampaign` registers its own row), an SSH transport inside the CLI.

## Key decisions

- **Sent rows without a message id** (point 1): an app's history rarely kept the provider's id. A placeholder id would
  read as a real one, so migration `0004` adds `imported_at timestamptz` and relaxes the check to "a `sent` row has a
  provider message id **or** was imported"; a non-`sent` row still never has one. Rollback in the file header.
- **`importDeliveries(ctx, rows)`** in `/server` (and `/next` with the request context, like `deliverOnce`): rows
  `{ scope, address, status: "sent" | "rejected", finishedAt: Date | string, providerMessageId?, reason?, kind? }`.
  Every row is validated first (scope pattern, single address, a real date not in the future, `reason` only on
  `rejected` and one of the four stored codes, default `mailing.rejected`; `kind` kebab-case, default
  `transactional`); any problem → `err([{ index, problem }])` and nothing is written. Valid rows go in batches of 500
  with `INSERT … ON CONFLICT DO NOTHING RETURNING`: a row already in the ledger (any status) is left alone, so a
  re-run imports nothing twice and a live claim is never overwritten. Stored as `attempts 1`, `claimed_at =
  finished_at`, `imported_at = now`, `campaign_id` null (scope carries the campaign). Same key twice in the input:
  the first wins, the rest count as `duplicates`. Result: `ok({ rows, imported, alreadyPresent, duplicates })`.
  No transaction across batches: the import is idempotent, a failed run is re-run.
- **`softure-mail import <file|->`**: JSON Lines (one row object per line, blank lines skipped), parsed with zod;
  `--dry-run` validates and counts without writing. Problems print as `line N: …` (never the address), exit 1.
- **stdin** (point 2): `-` as the content file or as `--recipients` reads stdin (not both). With content on stdin the
  `html:` path resolves against the working directory. `RunMailCliOptions.readStdin` for tests.
- **Recipients from the database** (point 2): module option `listCampaignRecipients(campaign, ctx)` returning an
  (async) iterable of addresses. `softure-mail campaign` without `--recipients` uses it; with neither, a usage
  error that names both. Together this is the documented container topology: `docker compose exec -T app npx
  softure-mail campaign - < launch.md`.
- **`maxAttempts`** (point 3): module option `maxAttempts: number (1–100) | null`, default 5; `deliverOnce`'s per-call
  `maxAttempts` may be `null` too and wins over the module's. `null` = `unavailable` always releases the claim. README
  explains 5: a short provider outage across a few runs is ridden out, while a provider that keeps failing on one
  mail does not keep it open forever; apps that retry on their own schedule pick `null`.
- **Versions**: mailing 0.1.9 (package.json, module.json, manifest, CHANGELOG), merged with #211's entry.

## Phase 1: ledger import (TDD)

`migrations/0004_allow_imported_deliveries.sql`, `src/schema.ts`, `src/server/import-deliveries.ts`,
`src/server/index.ts`, `src/next/` wrapper.

- `tests/import.test.ts`: sent row without and with message id, rejected default and given reason, campaign scope
  then `sendCampaign`/`planCampaign`/`deliverOnce` send nothing to imported recipients, re-run imports nothing,
  existing claimed row untouched, duplicates, every validation problem with nothing written, case/space-insensitive
  key, the database refuses a non-imported sent row without an id (constraint).

Done when: tests seen red, then green.

## Phase 2: maxAttempts and campaign recipients

`src/options.ts`, `src/contract.ts`, `src/server/deliveries.ts`.

- `tests/deliveries.test.ts`: module `maxAttempts: 2` closes on the 2nd; `null` (module and per call) never closes;
  per-call value wins. `tests/module.test.ts`: option validation.

## Phase 3: command and docs

- `src/cli/run.ts`, `src/cli/command.ts`: `import`, stdin, `listCampaignRecipients`; `tests/cli.test.ts`.
- README (import, topology, retries), docs/05 step, CHANGELOG, versions.

Done when: `npm run typecheck`, `lint`, `test`, `build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: ledger import

- [x] migration 0004 and schema — 3a45c77
- [x] importDeliveries — 3a45c77

### Phase 2: maxAttempts and campaign recipients

- [x] maxAttempts module option, null — 65f6e76
- [x] listCampaignRecipients option — 65f6e76

### Phase 3: command and docs

- [x] softure-mail import, stdin, recipients from the option — 7f03663
- [x] README, docs/05, CHANGELOG, version 0.1.9 — 7f03663

Gates (7f03663): typecheck, lint, test (4720 passed, 107 skipped), build green.
