# Plan: waitlist-funnel-hook

Input: change.md, research.md. Complexity: small (2 phases). Risk: low (a hook and a link rewrite, no data).

## Goal

- `waitlist({ onJoined })`: optional `(event: WaitlistJoinedEvent, ctx) => Promise<void> | void`,
  refused at startup when not a function. Called in the sign-up's transaction when a sign-up counts
  for the first time; errors propagate (rollback).
- `WaitlistJoinedEvent`: `{ signup: WaitlistSignup; via: "join" | "confirmation" }`.
- `waitlist({ rewriteConfirmationLink })`: optional `(path, ctx) => string | Promise<string>`;
  `deliverConfirmationMail` builds the link from its result when it is a path on the app that still
  carries the token, else (or on a throw) from the module's path, with a log line.
- `@softure-ai/analytics/next`: `countFunnelStep(step)`, a hook for any module's server event
  (savepoint, logs and never throws); `countRegistration` delegates to it.
- READMEs: waitlist §3 (option rows), §10 (the hook), §12 (the mail hop); analytics §10, §12 (the
  waitlist line removed).
- Example app: funnel step `waitlist` (`via: "server"`), `onJoined: countFunnelStep("waitlist")`,
  a `rewriteConfirmationLink` that tags the link with the join's channel; an e2e counts a tagged
  waitlist sign-up (double opt-in) under its channel.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| When the hook runs | first count only (`confirmedAt` null → set) | a funnel step is one per person; widenings are consent changes | research, unknown 1 |
| Hook context | waitlist ctx with the transaction as `db` | atomic with the sign-up, same as auth | research, unknown 2 |
| Failure policy | propagate, roll back | same as auth; the analytics helper swallows its own errors | research, unknown 3 |
| Analytics helper | generic `countFunnelStep`, `countRegistration` kept | analytics stays unaware of waitlist; no breaking change | research |
| Channel on the mail hop | `rewriteConfirmationLink` (path in, path out) | waitlist stays analytics-free; same shape as FU-7's `rewriteRedirect` | research |
| Rewrite safety | must be a same-app path keeping the token, else the module's link | the link must always confirm | research, risks |

Rejected: storing the channel on the sign-up row (analytics data in the waitlist's table); counting
at join time under double opt-in (counts requests nobody confirmed); calling the hook on every
request (inflates the step with repeat sign-ups).

## Phase 1: Modules

**Discipline:** TDD.

- Waitlist tests first: the hook is called once with the transaction ctx for a new sign-up
  (`via: "join"`), not for a repeat or widening; with double opt-in not at join, once at the first
  confirmation (`via: "confirmation"`), not for a reused link; a throwing hook rolls the sign-up
  back (no row, no consent); options refuse non-functions; the rewrite's result is used, a result
  that drops the token or leaves the app, and a throw, fall back to the module's link.
- Analytics tests: `countFunnelStep` counts with the channel and never throws.
- Code: options, contract, signups, confirmation mail, exports, READMEs.

## Phase 2: Example app and e2e

- `examples/next-app/softure.config.ts`: funnel step, `onJoined`, `rewriteConfirmationLink`.
- `e2e/analytics-funnel.spec.ts`: a waitlist sign-up from `/?z=<channel>`, confirmed through the
  mailed link, is counted as `waitlist: 1` under that channel; nothing is counted before the link is
  used. Its cleanup deletes the sign-up, consents and delivery rows.

## Risks and rollback

No migration. Rollback: revert the commits; apps that set the new options must drop them (strict
options schema).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Modules

#### Automated
- [x] 1.1 Waitlist and analytics tests for the hook, the rewrite and `countFunnelStep` pass — 9d16d99
- [x] 1.2 Gates green (typecheck, lint, test) — 9d16d99

### Phase 2: Example app and e2e

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — e05001d
- [x] 2.2 `npm run e2e` passes, including the new test in `e2e/analytics-funnel.spec.ts` — e05001d

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — e05001d
