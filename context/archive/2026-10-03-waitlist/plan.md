# Plan: waitlist

Input: change.md, research.md. Complexity: medium (2 phases). Risk: low.

## Goal

- `waitlist.signups` (migration 0001): `id` uuid, `email` (normalised, unique), `scopes text[]`,
  `placement`, `locale`, `created_at`, `updated_at`; shape checks only (research 2.1).
- Options: `scopes: [{ id, required?, document?, label: { en, pl? } }]` (1 to 16, unique, at least
  one), `placements` (default `["default"]`), `welcomeMail` (default true).
- `WAITLIST_RATE_LIMIT_BUCKETS`: `waitlist` per client, `waitlist-email` per address.
- `/server`: `joinWaitlist(ctx, { email, scopes, placement, clientKey })` →
  `Ok<{ signup, grantedScopes }> | Err<waitlist.* > | RateLimitRejection`; `deliverWelcomeMail`;
  `getSignup`; `listSignups({ scope?, placement? })`.
- Contributor: export and delete the sign-up of the user's account email.
- `/next`: `joinWaitlistAction` (welcome mail in `after()`), `Waitlist` server component.
- `/ui`: `WaitlistForm` with slots, `unstyled`, `consentLabels` for links.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope storage | validated text array, membership in code | scopes are the app's | research 2.1 |
| Widening | union in config order, never narrowed by a sign-up | roadmap outcome | research 3 |
| Consent | `recordConsent` per requested scope not currently granted, same transaction | evidence stays current | research 3 |
| Welcome mail | `deliverOnce` scope `waitlist.welcome:<id>`, kind `waitlist`, in `after()` | once per sign-up, unsubscribe link, answer independent of mail | research 1 |
| Dependencies | security, mailing, privacy (and auth through privacy) | buckets, mail, consents, account email | research 1 |
| Setup errors | asserted once per config (buckets, documents) | one clear error | auth precedent |

Rejected: a CHECK list or enum of scopes (research 2.1); a separate scopes table (the ledger
already keeps when each scope was granted).

## Phase 1: Module

**Discipline:** TDD.

- Migration, schema, options, contract, messages, `src/server/*`, manifest and `module.json`.
- `/next` action, server component; `/ui` form.
- Tests on PGlite: join (new, repeat widening, never narrowing, consent rows, outdated document,
  validation, rate limits, concurrent first sign-ups), welcome mail (once, list kind, suppressed,
  off), list and get, contributor, health, module options, form rendering, messages, architecture.

## Phase 2: Example app, e2e, docs

- Example config, the form on the home page, `e2e/waitlist.spec.ts` (sign up, widen, welcome mail,
  unsubscribe); `migrations.spec.ts`, `ops.spec.ts`, `scripts/container.mjs`.
- README sections 1 to 12; docs listing modules.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [x] 1.1 Join, welcome mail, contributor and health tests pass on PGlite — 9d32ca1
- [x] 1.2 Form, messages and module tests pass; `module.json` equals the manifest — 9d32ca1
- [x] 1.3 Gates green (typecheck, lint, test) — 9d32ca1

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — b8440a8
- [x] 2.2 `npm run e2e` passes, including `e2e/waitlist.spec.ts` — b8440a8

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — b8440a8
