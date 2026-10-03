# Plan: mailing-consent-sync

Input: change.md, research.md. Complexity: small (2 phases). Risk: medium (consent evidence).

## Goal

- `mailing({ onUnsubscribed })`: `(event: { recipientKey, source }, ctx) => Promise<void>`, called
  by `unsubscribe()` after the suppression insert, in the same transaction, on every verified link.
- `liftSuppression(ctx, address)` in `@softure-ai/mailing/server`: deletes the address's
  suppression when its source is `page` or `one-click`; returns whether it lifted one.
- Privacy: `ConsentSubject` gains `{ emailKey }` (43 base64url characters), accepted by
  `recordConsent`, `getConsent`, `hasConsent`, `listConsents`.
- Waitlist: `withdrawWaitlistConsents(event, ctx)` in `/server` records `granted: false`
  (source `unsubscribe`) for each declared scope whose latest record grants it; `joinWaitlist`
  lifts the address's own opt-out in its transaction, and when it lifted one, the sign-up's scopes
  become the requested ones instead of the union (plan review W1).
- Example app wires the hook; e2e covers unsubscribe → withdrawal → sign-up → lift.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the purpose mapping lives | the module that recorded the consent (waitlist) | suppression is global, link carries no kind | research, unknown 1 |
| Hook shape | an option the app wires, like `onRegistered` | mailing depends on no module; the app composes | research, current state |
| Atomicity | hook in the suppression's transaction | ledger and list never disagree | research, risks |
| Subject without address | `{ emailKey }` in privacy | the link holds only the key; same hash | research, current state |
| What is lifted | own opt-outs only (`page`, `one-click`) | a bounce or operator block is not the person's choice | research, unknown 2 |
| When it is lifted | every successful join, in its transaction | a sign-up is an explicit consent; FU-2 moves it to confirmation | research, risks |
| Scopes after a lift | the requested ones, not the union | the opt-out withdrew the rest | plan review W1 |

Rejected: mailing calling privacy directly (adds an auth dependency to mailing and still needs the
purposes); withdrawing after commit (the gap returns when the hook fails); a per-kind suppression
(a schema change outside this item).

## Phase 1: Modules

**Discipline:** TDD.

- privacy: `{ emailKey }` subject; tests for record, read, list, and a malformed key.
- mailing: hook option and types, transaction in `unsubscribe`, `liftSuppression`; tests: hook
  called with key and source in the transaction, not called for an invalid link, a throwing hook
  rolls the suppression back, lift by source, the recipient key equals privacy's email key.
- waitlist: `withdrawWaitlistConsents` and the lift in `joinWaitlist`; tests: withdrawal per
  granted scope, idempotent, unknown key a no-op, re-join lifts own opt-out and keeps an operator one,
  re-join after an opt-out replaces the scopes.
- READMEs: mailing §10/§12, privacy subject, waitlist §10 to §12.

## Phase 2: Example app and e2e

- `mailing({ onUnsubscribed: withdrawWaitlistConsents })` in the example config.
- `e2e/waitlist.spec.ts`: unsubscribing records withdrawals; signing up again lifts the suppression
  and grants again.

## Risks and rollback

No migration; revert the commits. A throwing hook blocks unsubscribes until fixed (tests cover the
waitlist handler; the page shows its retry state).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Modules

#### Automated
- [ ] 1.1 privacy, mailing and waitlist tests for the hook, the key subject, withdrawal and lift pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Example app and e2e

#### Automated
- [ ] 2.1 Gates green (typecheck, lint, test, build)
- [ ] 2.2 `npm run e2e` passes, including the new tests in `e2e/waitlist.spec.ts`

#### Manual
- [ ] 2.3 Impl review recorded in `reviews/impl-review.md`
