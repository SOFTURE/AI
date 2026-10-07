# Plan: waitlist-list-adoption

Input: change.md (research and framing skipped, reasons there). Complexity: medium (four phases).

## Today (master `88fc13c`)

- `waitlist.signups` (migrations 0001-0002) has no channel column; a confirmed row needs `confirmed_at >= created_at`,
  an unconfirmed row needs a pending request. Nothing inserts rows except `joinWaitlist`.
- Consents go through privacy's `recordConsent`, which stamps the clock's now and the configured document version.
  Privacy's internal `insertConsent(ctx, input, recordedAt)` already takes a time (the registration hook uses it), but
  it is not exported and always records the configured version.
- An unsubscribe is mailing's `unsubscribe(ctx, link, source)`: a `mailing.suppressions` row (source `page` or
  `one-click`, which a new sign-up lifts; `operator`, which it does not) and the app's `onUnsubscribed` hook, here
  `withdrawWaitlistConsents`, which withdraws every scope still granted, at now. `suppressRecipient` only writes
  `operator` rows.
- `joinWaitlistAction` returns `{ status: "ok" }`; mailing exports `buildUnsubscribeLinks(config, address, secret)`
  and `readUnsubscribeSecrets(env)`, so the waitlist can build the signed link without a mailing change.
- billing's `import-entitlements` (`@softure-ai/billing/scripts`) is the import precedent: an ops script over a JSON
  file, dry run by default, row-numbered refusals without emails, idempotent, never shortens.

## Goal

`@softure-ai/waitlist` 0.1.7 with all four points of #214, and `@softure-ai/privacy` 0.1.7 with `importConsent`.

**Out of scope:** changes in `@softure-ai/mailing` (#211/#212 own it now), importing unconfirmed (pending double
opt-in) requests, a counter in analytics for imported history.

## Key decisions

- **Past consents (privacy):** new `importConsent(ctx, { ...RecordConsentInput, recordedAt, documentVersion? })`.
  `recordedAt` must not be after the clock's now (else `privacy.consent_invalid`); `documentVersion` (1-64 printable
  characters, only with `document`) replaces the configured version, so a consent given to an older text stays an
  older-version consent (`hasConsent` then says false and a new sign-up records the current one). `recordConsent` is
  unchanged.
- **Channel (migration 0003):** `signups.channel text NULL`, 1-64 visible ASCII characters (`^[!-~]{1,64}$`). Set at
  the first sign-up like `placement` and never overwritten. Option `resolveChannel({ config })` (sync or async), called
  by the join action, e.g. `() => getChannel()` from `@softure-ai/analytics/next`; a throw or an invalid value is logged
  by kind and the sign-up goes on without a channel (attribution never blocks a sign-up). `joinWaitlist` takes
  `channel?: string | null` and refuses a malformed one with `waitlist.form_invalid`. `WaitlistSignup.channel`,
  `listSignups({ channel })`, `countSignupsByChannel(ctx)` (confirmed sign-ups per channel, `null` for none, for a
  per-channel report), and the privacy export carry it.
- **Import:** `importSignups(ctx, rows)` in `/server` and `createImportSignupsScript(config, { scopeAliases? })` in a
  new `/scripts` export (`import-signups --file=…`, an ops script like billing's). A row: `email`, `scopes`,
  `placement`, `locale`, `signedUpAt`, optional `id`, `confirmedAt` (default `signedUpAt`), `consentedAt` (default
  `confirmedAt`), `documentVersions` (document id → version), `channel`, `unsubscribedAt`. The script expands
  `scopeAliases` (e.g. `{ lists: ["launch", "newsletter"] }`) before validation; `importSignups` takes module scope
  ids. Rules, all in one transaction (the script's, or `importSignups`' own):
  - the whole input is checked first (scopes and placements declared, times not in the future, `confirmedAt >=
    signedUpAt`, `unsubscribedAt >= consentedAt`, no email or id twice); any problem refuses everything, naming row
    numbers only;
  - a new email is inserted (with its `id` when given) as confirmed; an email already present widens its scopes (never
    narrows), moves `created_at`/`confirmed_at` back to the imported times when they are earlier, fills an empty
    channel, and keeps placement and locale; an existing row that is still unconfirmed takes the imported scopes and
    becomes confirmed (its pending link stays); a row whose `id` belongs to another email, or whose email is stored
    under another `id`, refuses the import (the app's old unsubscribe links resolve by that id);
  - each scope gets a granted consent at `consentedAt` (source `waitlist-import`) unless the same record (purpose,
    granted, time) is already in the ledger, so a re-run adds nothing;
  - an unsubscribed row gets a withdrawal per scope at `unsubscribedAt` (same idempotency), and, when no scope is
    granted any more, a `page` opt-out through mailing's `unsubscribe` with a link signed by the current
    `MAILING_UNSUBSCRIBE_SECRET` (a person's own opt-out, which their next sign-up lifts; the suppression row's time is
    the import's, the withdrawal holds the historical one). Without the secret an import with unsubscribed rows is
    refused before any write. `onUnsubscribed` runs as for any unsubscribe; `withdrawWaitlistConsents` finds nothing
    left to withdraw;
  - no rate limit, no mail, no `onJoined` (history, not a new sign-up);
  - `getSignupById(ctx, id)` lets the app's mailing `legacyUnsubscribe.verify` turn an old link's id into the address;
  - returns counts: `inserted`, `updated`, `unchanged`, `consentsRecorded`, `withdrawalsRecorded`, `optOutsRecorded`.
- **Unsubscribe link after sign-up:** option `unsubscribeLinkOnSuccess` (default `false`). On, `joinWaitlistAction`
  returns `unsubscribeUrl` (the signed page link from `buildUnsubscribeLinks`) with `status: "ok"`, for a new and a
  known address alike (the answer must not tell them apart); never with `confirmation_sent`. The setup check refuses
  the option without `MAILING_UNSUBSCRIBE_SECRET`. `WaitlistForm` shows the link under the success notice with new
  copy (`form.unsubscribeHint`, `form.unsubscribeLink`). README states the trade-off: whoever submits an address gets
  its unsubscribe link, so it fits single opt-in lists only.

## Phases

### Phase 1: privacy importConsent (TDD)

- `modules/privacy/src/server/consents.ts`: `importConsent`, `ImportConsentInput`; `insertConsent` takes an optional
  version override. Export from `/server`.
- Tests: a past time and an older version are stored as given; a future time and a version without a document are
  `consent_invalid`; an older-version import makes `hasConsent` false.
- Done when: privacy tests green.

### Phase 2: channel (TDD)

- Migration `0003_add_channel.sql`, schema, contract, `joinWaitlist` input, `resolveChannel` option and the action,
  `listSignups` filter, `countSignupsByChannel`, privacy export.
- Tests: channel stored at first sign-up and kept on repeat; malformed refused by the server function; the action
  stores a resolved channel and survives a throwing resolver; filter and counts.
- Done when: waitlist tests green.

### Phase 3: import (TDD)

- `src/server/import.ts` (`importSignups`), `src/scripts/import-signups-script.ts`, `src/scripts/index.ts`,
  `package.json` export `./scripts` and the `@softure-ai/ops` dependency.
- Tests: insert with id, times and channel; consents at the historical time and version; re-run changes nothing;
  widening and earlier times on an existing row, never narrowing; id/email clash refused; validation refusals name
  rows, not emails; unsubscribed row gets withdrawals and a liftable opt-out, and a later sign-up lifts it; refused
  without the secret; script dry run writes nothing, `--commit` writes, aliases expand.
- Done when: waitlist tests green.

### Phase 4: unsubscribe link, docs, versions

- Option, action, setup check, form, messages (en, pl).
- Tests: the action returns the link (verifiable with the secret) only when on and only for `ok`; the setup refuses the
  option without the secret; the form renders the link.
- README (waitlist, privacy), CHANGELOGs, versions 0.1.7 (package.json, module.json, manifest), waitlist depends on
  privacy `^0.1.7`.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: privacy importConsent

- [x] importConsent with tests — 0304e57

### Phase 2: channel

- [x] migration, schema and server functions — c5297ae
- [x] resolveChannel in the action, export — c5297ae

### Phase 3: import

- [x] importSignups — 4072a02
- [x] import-signups script — 4072a02

### Phase 4: unsubscribe link, docs, versions

- [x] unsubscribeLinkOnSuccess in the action and form — a793502
- [x] README, CHANGELOGs, versions — a793502
