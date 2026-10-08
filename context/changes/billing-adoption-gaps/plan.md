# Plan: billing-adoption-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: medium (four phases).

## Today (master `a0dbf19`)

- The pure machine has `extend_trial` (refuses an end at or before now, never shortens), but no server function,
  action or form uses it. `BillingAdminPage` has three cards: invoice requests, grant a plan, account history.
- `getAccountHistory` merges `manual_grants` and `payments`; `AccountHistoryEntry` is a union on `source`.
- `importEntitlement` applies the `import` event through `changeEntitlement`, so each end only moves later than the
  record the account has, and an account without a row starts from `getDefaultRecord(created_at)`: a legacy trial
  shorter than the derived one cannot be carried.
- `PaymentPage` and `BillingAdminPage` render `<main>` with `Card`s, whose titles are `<h2>`; no `<h1>`.
- mailing: `OutgoingMail` has no `replyTo`; `reply-to` is a reserved header; `sendMail` passes the config `replyTo`
  (or null) to the provider; the Resend provider and the test outbox already carry `ProviderMessage.replyTo`.
- Foreign keys from `auth.users` without an index starting with their column: `payment_requests.user_id` (only the
  partial `payment_requests_one_open`), `manual_grants.granted_by`, `manual_grants.revoked_by`.

## Goal

`@softure-ai/billing` 0.1.8 and `@softure-ai/mailing` 0.1.10 with all five points of #229.

**Out of scope:** revoking a trial extension (the trial can be extended again; an over-long one is the operator's
mistake to fix by SQL, as before), an `extend-trial` ops script, extending by a number of days in the form.

## Key decisions

- **Trial extensions (migration 0010):** table `billing.trial_extensions` (`id`, `user_id` → `auth.users` ON DELETE
  CASCADE, `extended_by` → `auth.users` ON DELETE SET NULL, `extended_at`, `previous_ends_at`, `ends_at`, CHECK
  `ends_at > previous_ends_at`, CHECK `ends_at > extended_at`), indexes on `user_id` and partial on `extended_by`.
- **`extendTrialManually(ctx, { userId, until, adminId })`** in `/server`: one transaction, account (key share) → pin
  the derived row → `lockEntitlementRow` → read → `extend_trial`; refuses `billing.end_not_in_future` (until ≤ now)
  and the new `billing.trial_not_extended` (until ≤ current trial end: an entry that changes nothing is not
  recorded); a refusal undoes the pin. Returns `{ extensionId, entitlement }`.
- **Form:** the admin enters the trial's new **last day** (`<input type="date">`, field `trialLastDay`); the end is the
  start of the next day in the app's time zone, the same day arithmetic as the derived trial. A malformed day →
  new `billing.day_invalid`. `TrialForm` in `/ui`, `extendTrialAction` in `/next` (admin role from the session first,
  revalidates the admin page), new card "Extend a trial" between grant and history.
- **Trial under paid access:** extending is allowed whatever the status (paid access wins in `resolveEntitlement`,
  the longer trial shows once it ends); the notice says the new last day.
- **History:** `AccountHistoryEntry` gets `{ source: "trial", id, at, previousEndsAt, endsAt }`; the row reads "Trial
  extended", "Until {last day}", "Extended on {date}", "Trial was until {previous last day}".
- **Privacy:** export `trialExtensions` (`extendedAt`, `previousEndsAt`, `endsAt`; not `extended_by`), erase them.
  `module.json` / manifest list the table.
- **Exact import:** `importEntitlement(ctx, { ...input, mode: "replace" })` (overloaded; merge keeps its return type)
  inserts `{ trialEndsAt: input ?? derived, paidUntil: input ?? null, isLifetime: input ?? false }` when the account
  has no row. An account whose row already holds exactly that record counts as imported (no write), so a re-run is
  a no-op; any other row is `billing.entitlement_exists` and nothing is written. `import-entitlements --exact` checks
  every row first and refuses the whole file, naming row numbers, when any account has a different row.
- **Headings:** messages `payment.heading` / `admin.heading`; both pages take `heading?: string | null` (a string
  replaces the copy, `null` renders none for an app whose frame has the `<h1>`). The `<h1>` is the first child of
  `<main>`.
- **mailing `replyTo`:** optional on `OutgoingMail`, trimmed, `isSingleAddress`, failure field `replyTo`;
  `ValidMail.replyTo: string | null`; `sendMail` sends `mail.replyTo ?? config.replyTo ?? null`. Allowed for every
  kind. `reply-to` stays reserved as a header.
- **Indexes:** in `0010`: `payment_requests (user_id)`, `manual_grants (granted_by) WHERE granted_by IS NOT NULL`,
  `manual_grants (revoked_by) WHERE revoked_by IS NOT NULL`. A test asserts every billing foreign key has an index
  starting with its column.

## Phases

### Phase 1: mailing per-mail Reply-To (TDD)

- `modules/mailing/src/contract.ts`, `server/validate-mail.ts`, `server/send-mail.ts`: the field, its check, the
  default. Tests in `tests/send-mail.test.ts`: the mail's value reaches the provider; without it the config value; a
  list in `replyTo` or a line break is `mailing.invalid_input` with field `replyTo`.
- README section on `OutgoingMail`, CHANGELOG `0.1.10`, version bump.
- Done when: mailing tests green.

### Phase 2: migration 0010 and trial extensions (TDD)

- `migrations/0010_record_trial_extensions_and_index_foreign_keys.sql`, `schema.ts`, manifest tables.
- `server/trials.ts` (`extendTrialManually`), history entry in `server/grants.ts`, privacy export/erase.
- Tests: extension moves the trial, records the row, a no-op / past end refuses and writes nothing (no row pinned),
  unknown account, a concurrent grant and extension both count (lock order), history lists it, privacy export and
  erase, every billing FK has a leading index (catalog query).
- Done when: billing tests green.

### Phase 3: admin UI, action, headings

- `fields.ts` (`TRIAL_LAST_DAY_FIELD`), `contract.ts` (`TrialFormState`, new codes), messages en/pl, `ui/trial-form.tsx`,
  `next/actions.ts` (`extendTrialAction`), `next/pages.tsx` (card, history row, `<h1>`, `heading` prop), exports.
- Tests in `admin-ui.test.tsx` / `next-guards.test.ts`: the form renders and submits, the action refuses a non-admin
  before reading the form, a bad day is `billing.day_invalid`, one `<h1>` inside `<main>` on both pages, `heading`
  replaces and `null` hides it.
- Done when: billing tests green.

### Phase 4: exact import, docs, versions

- `importEntitlement` overload, `import-entitlements --exact`. Tests: account created 30 days ago with a legacy trial
  that ended yesterday is read-only after an exact import; an account with a row is refused; the script refuses the
  whole file naming the rows; a re-run of the same file changes nothing.
- billing README (trial extension, exact import, heading, onRequest with `replyTo`), CHANGELOG `0.1.8`, version bump.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: mailing per-mail Reply-To
- [x] Phase 2: migration 0010 and trial extensions
- [x] Phase 3: admin UI, action, headings
- [ ] Phase 4: exact import, docs, versions
