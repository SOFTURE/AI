# Plan: waitlist-opt-out-guard

Input: change.md (research skipped, framing inline in D1; reasons there). Complexity: small (one phase, one
package).

## Goal

Without double opt-in, `joinWaitlist` of an address on mailing's suppression list writes nothing and returns
`status: "suppressed"`; the join action answers it like `ok`; with double opt-in nothing changes. Tests, README,
CHANGELOG and waitlist 0.1.8.

**Out of scope:** mailing (no new export); the adopting app's removal of its `isSuppressed` workaround; a
per-call confirmation for opted-out addresses without double opt-in (D1).

## Findings (the reading behind the plan)

- `server/signups.ts`: `joinWaitlist` → `joinNow` (no double opt-in) or `requestConfirmation`. `joinNow` calls
  `liftSuppression` after inserting a new row, and `applyRequest` (shared with `confirmSignup`) calls it for a
  known row; its result decides whether the stored scopes are replaced (after a lifted opt-out) or widened.
- `requestConfirmation` writes only the pending request and the link; nothing is lifted or recorded until
  `confirmSignup`.
- `next/actions.ts`: `joined` → `ok` (+ `unsubscribeUrl` when enabled) and the welcome mail after the response;
  `confirmation_required` → `confirmation_sent` and the confirmation mail.
- Mailing: `isSuppressed(ctx, address)` (any source), `liftSuppression` (only `page`/`one-click`). Operator rows
  (a bounce, a complaint, a script) are never lifted.
- README § 10 says imported unsubscribed rows get "an opt-out their next sign-up lifts"; § 1 and the unsubscribe
  section say a new sign-up lifts the address's own opt-out. Both need the double opt-in qualifier.
- The README asks apps to mount the confirmation page only with double opt-in.

## Key decisions

- **D1 A distinct outcome, not a confirmation link.** The issue offers two options. Routing an opted-out address
  through the confirmation link without double opt-in needs the confirmation page, which apps without double
  opt-in are not asked to mount (the mailed link would 404), and its `confirmation_sent` answer would tell the
  person at the form that the address unsubscribed. So `joinWaitlist` returns `ok({ status: "suppressed" })` and
  writes nothing; an app that wants opted-out people to come back through the form turns on double opt-in. This
  matches what the adopting app's workaround does, as a module guarantee.
- **D2 Any suppression blocks, not only the person's own.** The check uses `isSuppressed` (every source). An
  operator row was never lifted by a sign-up, so storing the request only recorded consents and counted a sign-up
  (`onJoined`) for an address no list mail can reach; a complaint is the recipient's own act as much as a page
  opt-out. One rule, and no new mailing export.
- **D3 The check runs in the sign-up's transaction before any write, and the join path no longer lifts.** Without
  double opt-in the address is known not to be suppressed when the request is applied, so `liftSuppression` there
  could only undo an opt-out committed concurrently after the check. The lift moves to `confirmSignup` only:
  `applyRequest` takes whether an opt-out was lifted instead of lifting itself.
- **D4 The action answers `suppressed` like `ok`.** Same `status: "ok"`, same `unsubscribeUrl` when the app enabled
  it (a link for an address that has already unsubscribed changes nothing), no welcome mail, no `onJoined`. The
  rate limits were already counted, as for any request.
- **D5 Docs.** README § 1, the unsubscribe section, the server API list (the new outcome) and § 10 (import), a
  CHANGELOG `0.1.8` entry naming the behaviour change; `package.json` 0.1.8 and the lockfile.

## Phase 1: the guard (TDD)

- Tests (`tests/opt-out-guard.test.ts`): without double opt-in, for a `page` and a `one-click` opt-out of a known
  address and of an address that never signed up: `status: "suppressed"`, the opt-out stays, no row is written or
  changed, no consent recorded, `onJoined` not called; an operator suppression gives the same; a request
  refused for its form still answers the refusal (validation before the check); with double opt-in the request
  still waits for its link and the link lifts the opt-out (existing tests cover the lift in `confirmation.test.ts`).
- Update the existing expectations that relied on the lift without double opt-in: `unsubscribe.test.ts` ("lifts
  the opt-out on a new sign-up" moves to double opt-in; "keeps an operator's suppression and widens as usual" is
  rewritten to assert nothing is widened, plan review F2) and `import.test.ts` (F3).
- Action test (`tests/next-join.test.tsx`): a suppressed address answers `{ status: "ok" }` (and the
  `unsubscribeUrl` when enabled), sends no mail.
- Code: `server/signups.ts`, `next/actions.ts`, the server index export of the new type.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the guard

#### Automated
- [x] 1.1 Guard tests seen red, then green — 0bebb36
- [x] 1.2 Action answers a suppressed address like a sign-up that counted — 0bebb36
- [x] 1.3 Gates green (typecheck, lint, test, build) — 0bebb36
- [x] 1.4 README, CHANGELOG and version 0.1.8 — 0bebb36
