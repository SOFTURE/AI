# Plan: mailing-adoption-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: medium (four phases).

## Today (master `518ef61`)

- `ProviderOutcome` has `sent | rejected | unavailable`, each failure with an optional `httpStatus`; `sendMail` logs
  the status and returns `err(code)` without it (`send-mail.ts`).
- `resend()` maps 5xx, 408, 429 and a concurrent idempotent request to `unavailable`, every other 4xx to `rejected`,
  so a bad key (401/403) closes every delivery of a campaign as `rejected` for good (`deliveries.ts` closes any
  non-`unavailable` failure).
- `deliverOnce` retakes a claim older than 15 min (`DEFAULT_STALE_CLAIM_MS`) at any age, with the same idempotency key;
  Resend keeps a key for 24 h, so a retake after that can send twice. The window is a `DeliverOptions` field, not a
  module option, so the `softure-mail` command cannot set it.
- `sendCampaign` sends to every address of the iterable; there is no filter.
- The unsubscribe page, action and one-click route read only `r`/`t` signed links.

## Goal

`@softure-ai/mailing` 0.1.7 with all five points; `@softure-ai/billing` 0.1.7 handles the new outcomes.

**Out of scope:** publishing (the auto-release run after the merge), a bounce/complaint webhook, recipient sources other
than the iterable / file.

## Key decisions

- **Status in the result** (point 1): `SendMailResult = Ok<SentMail> | SendMailFailure`, where
  `SendMailFailure = Err<MailingErrorCode> & { httpStatus?: number }`. Present only when the provider answered with a
  status. Additive: `result.error` reads as before. `DeliveryOutcome` failures (`rejected`, `retry-later`, `halted`)
  carry it too, and migration `0003` adds `deliveries.provider_status integer` (100-599, null when there was none),
  written on close and on release.
- **New codes** (point 2): `mailing.provider_refused` (the provider refuses the sender: bad key, account suspended or
  restricted) and `mailing.quota_exceeded` (the account's sending quota is spent). New `ProviderOutcome` statuses
  `refused` and `quota_exceeded`. `resend()`: 401 and 403 → `refused`; 429 with name `rate_limit_exceeded` stays
  `unavailable`, any other 429 (daily or monthly quota) → `quota_exceeded`. A provider that answers an unknown status
  still reads as `unavailable`.
- **Halt** (point 2): `deliverOnce` releases the claim (back to `pending`, status stored) and returns
  `{ status: "halted", reason, httpStatus? }` for both codes, whatever the attempt count: nothing is closed.
  `sendCampaign` stops at the first `halted` and returns its summary with `halted: { reason, httpStatus? } | null`;
  the remaining recipients are untouched. The CLI prints why and exits 1. A halt gives its attempt back
  (`attempts - 1`, so `0` is allowed for a `pending` row; migration `0003` relaxes the check): a week of runs with a
  bad key must not use up `maxAttempts` and turn the first `unavailable` after the fix into a final rejection. Billing's reminder loop counts it as
  `retryLater` and stops.
- **Legacy links** (point 3): option `legacyUnsubscribe: { params: string[]; verify(values, ctx) }`. `params` are the
  query names of the old link (1 to 8, `^[A-Za-z][A-Za-z0-9_-]{0,31}$`, never `r` or `status`); `verify` gets their
  values when all are present once (each at most 512 characters, else the link is invalid) and returns the recipient's address when the link is genuine, else `null`. The
  module hashes the address (`getRecipientKey`) and records the opt-out exactly like a signed link (same transaction,
  same `onUnsubscribed`). A signed link (`r` present) always takes the signed path, so a shared `t` cannot route a
  link to the hook. The page shows the button for a legacy link (hidden inputs carry its values), the action and the
  one-click POST verify it; the app mounts the same page and route at its old paths. `verify` must check the
  signature itself (README); it runs before any write, and a throw is a failure (500 / "failed"), not "invalid".
  Public API: `readUnsubscribeLink(params, config)` returns `{ scheme: "signed", token } | { scheme: "legacy", values }
  | null`; `unsubscribe` accepts that link (a bare `UnsubscribeToken` still works).
- **Recipient filter** (point 4): option `filterCampaignRecipient({ address, recipientKey, campaign: { id, kind } },
  ctx) => Promise<boolean>`. `sendCampaign` and `planCampaign` skip a recipient it refuses before the ledger is
  touched (no row: a later consent lets a re-run send). Counted as `filtered` in the summary and the plan. A throw
  propagates (a database failure, like the others).
- **Claim windows** (point 5): options `staleClaimMs` (default 15 min) and `uncertainClaimMs` (default 23 h, under
  Resend's 24 h key window), `DeliverOptions` override both. A claim older than `uncertainClaimMs` is not retaken:
  `deliverOnce` returns `{ status: "uncertain" }`, the campaign counts it, the CLI lists the count, exits 1 and names
  `--resend-uncertain`, which (`DeliverOptions.retakeUncertain`) retakes them. Schema check: `uncertainClaimMs >
  staleClaimMs`. `planCampaign` reports `uncertain`.
- **Messages**: en/pl copy for the two codes (`getMailingErrorMessage` would otherwise fall back to `unavailable`).
- **Versions**: mailing 0.1.7 (package.json, module.json, manifest, CHANGELOG), billing 0.1.7.

## Phase 1: provider failures (TDD)

Points 1 and 2 in `contract.ts`, `send-mail.ts`, `providers/resend.ts`, `testing/fake-provider.ts` (respond may answer
the new statuses), messages.

- `tests/resend.test.ts`: 401 and 403 → `refused` with status; 429 `daily_quota_exceeded` / `monthly_quota_exceeded` /
  no name → `quota_exceeded`; 429 `rate_limit_exceeded` → `unavailable`.
- `tests/send-mail.test.ts`: each failure returns its code and `httpStatus`; without a status there is no field; an
  unknown status from a provider reads as `unavailable`.
- `tests/messages.test.ts`: both dictionaries have the new codes.

Done when: tests seen red, then green.

## Phase 2: ledger and campaigns

Points 1 (storage), 2 (halt), 4, 5 in `deliveries.ts`, `campaigns.ts`, `options.ts`, `schema.ts`, migration `0003`.

- `tests/deliveries.test.ts`: refused and quota release the claim (row `pending`, `provider_status` stored) whatever
  the attempt; rejected stores its status; a claim older than `uncertainClaimMs` returns `uncertain` and sends
  nothing; `retakeUncertain` sends it with the same key; options come from the module config, `DeliverOptions` win.
- `tests/campaigns.test.ts`: a refusal on the second recipient stops the run (third untouched, `halted` set); a re-run
  after the key is fixed sends the rest; the filter skips (no row, `filtered` counted, plan agrees).
- `tests/module.test.ts`: `uncertainClaimMs <= staleClaimMs` is refused.

## Phase 3: legacy unsubscribe links

Point 3 in `unsubscribe-link.ts`, `suppressions.ts`, `next/pages.tsx`, `next/actions.ts`, `next/route.ts`, `options.ts`.

- `tests/suppressions.test.ts`: a legacy link that `verify` accepts suppresses the address's key and runs
  `onUnsubscribed`; refused → `mailing.invalid_link`, nothing stored; without the option a legacy link is invalid;
  a signed link never calls `verify`.
- `tests/next-unsubscribe.test.tsx` / `tests/next.test.ts`: page renders the button with the legacy values; the
  action and one-click POST record it; a `verify` throw is `failed` / 500.
- `tests/module.test.ts`: `params` with `r`, `status`, duplicates or bad names are refused.

## Phase 4: command, billing, docs

- CLI: `--resend-uncertain`; summary prints `filtered`, `uncertain`, and the halt; exit 1 on halt or uncertain
  (`tests/cli.test.ts`).
- Billing reminder loop: `halted` stops the loop (counted `retryLater`), `uncertain` counts as `skipped`
  (`modules/billing/tests/…reminder…`).
- README (codes, halt, legacy links, filter, windows), CHANGELOGs, versions.

Done when: `npm run typecheck`, `lint`, `test`, `build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: provider failures

- [x] status in the result and the new codes — 9a7fda2
- [x] resend mapping — 9a7fda2

### Phase 2: ledger and campaigns

- [x] provider status stored, halt releases the claim
- [x] campaign stops on halt
- [x] recipient filter
- [x] claim windows and uncertain claims

### Phase 3: legacy unsubscribe links

- [ ] legacyUnsubscribe option and unsubscribe
- [ ] page, action and one-click route

### Phase 4: command, billing, docs

- [ ] CLI flags and summary
- [ ] billing reminder loop
- [ ] README, CHANGELOGs, versions
