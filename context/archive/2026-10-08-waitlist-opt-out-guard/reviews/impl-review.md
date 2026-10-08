# Implementation review: waitlist-opt-out-guard

Reviewed: the branch diff against `plan.md` (D1-D5, Phase 1) and the plan review's accepted findings.

Verdict: **approve** (no open blocking findings; two findings fixed in the change, one recorded).

## Plan conformance

- D1: `joinWaitlist` returns `ok({ status: "suppressed" })` (type `SuppressedSignup`, exported from `/server`)
  without double opt-in; no confirmation link without double opt-in.
- D2: the check is `isSuppressed` (every source); `opt-out-guard.test.ts` runs `page`, `one-click` and `operator`
  for a new and a known address.
- D3: the check is the first statement of `joinNow`, inside the sign-up's transaction; `joinNow` no longer calls
  `liftSuppression`; `confirmSignup` lifts before `applyRequest`, which now takes `isOptOutLifted`.
- D4: the action answers `suppressed` with `{ status: "ok" }` plus the same `unsubscribeUrl`, schedules no mail
  (`next-join.test.tsx` counts the `after` callbacks and compares the answer's keys with a counted sign-up's).
- D5: README § 1, the server API list, the unsubscribe paragraphs, § 10 and the `unsubscribeLinkOnSuccess` row;
  CHANGELOG 0.1.8; `package.json`, `module.json` and the lockfile at 0.1.8.

## Findings

### I1 (Warning, fixed): mailing's README promised the old lift
`modules/mailing/README.md` named "a new waitlist sign-up" as a consent that calls `liftSuppression`. Reworded to
a confirmed sign-up, and the `liftSuppression` paragraph now says the consent must be provably the recipient's.
Docs only; mailing's code and version are unchanged.

### I2 (Suggestion, fixed): tests that read `value.signup` without narrowing
The widened result union made `result.value.signup` a type error in `signups.test.ts`, `welcome-mail.test.ts` and
`joined-hook.test.ts`. Each now narrows (the `signups.test.ts` helper throws on `suppressed`, which that file
never sets up). The same narrowing is what an app's own code needs; the CHANGELOG says so.

### I3 (Suggestion, recorded): the race with a concurrent unsubscribe
As in plan review F4: the suppression list is read, not locked. Accepted; the join path no longer lifts, so the
remaining window can at worst record a consent next to a fresh opt-out, and mailing still refuses list mail.

## Evidence

- `opt-out-guard.test.ts`: 6 of 10 cases red on the old code (the `suppressed` outcome and "nothing written"),
  all green after.
- Gates: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` green on the branch.
- The example app's e2e runs with double opt-in, where the behaviour is unchanged (plan review F1).
