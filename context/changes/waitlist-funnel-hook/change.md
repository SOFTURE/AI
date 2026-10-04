---
change_id: waitlist-funnel-hook
title: "Waitlist sign-ups are counted in the analytics funnel under their channel"
status: implemented
roadmap_item: FU-8
branch: claude/fu-8-waitlist-funnel-rx6rhh
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app counts every waitlist sign-up in the analytics funnel, under the channel the visit came
with, through a waitlist hook `waitlist({ onJoined })` that runs in the sign-up's transaction (like
auth's `onRegistered`). The funnel never reads the waitlist's table. With double opt-in the sign-up
is counted when its link is used, and the channel still reaches the count. An e2e in the example
app shows a tagged waitlist sign-up counted under its channel.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-8).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-8** (roadmap `followups`):

> - **Outcome:** The waitlist offers an `onJoined` hook (in the sign-up's transaction, like auth's `onRegistered`) so an app counts waitlist sign-ups in the analytics funnel with `recordFunnelStep` and the channel, without the funnel reading the waitlist's table.
> - **Unknowns:** Whether the hook runs for a repeat sign-up that only widens scopes; the hook's context (the transaction) and its failure policy.
> - **Risk:** LOW. Waitlist sign-ups are missing from the funnel report until then.
> - **Baseline:** monetization MO-5 `analytics-funnel`: the funnel counts server steps through hooks (`countRegistration` for auth); the waitlist has no hook, so its sign-ups cannot be counted (FIRE_TRACKER's report read `waitlist_signups` directly, which the modules do not allow across schemas). After: an e2e where a waitlist sign-up is counted under its channel.

Today: `joinWaitlist` and `confirmSignup` (`modules/waitlist/src/server/signups.ts`) return
`isNew` / `isFirstConfirmation` but call nothing; waitlist README §10 says "None of its own".
Analytics' `countRegistration(step)` (`modules/analytics/src/next/channel.ts`) is typed for auth's
event. The example app runs the waitlist with double opt-in, so a sign-up counts on the
confirmation page, opened from a mail link that carries no channel tag (analytics README §12,
"first party only").

## Constraints

- Owns `modules/waitlist/` (hook, options, README, tests), a small generic hook in
  `modules/analytics/src/next/` and its README §10/§12 lines, the example app's waitlist and funnel
  config, `e2e/analytics-funnel.spec.ts`.
- FU-7 (`analytics-action-redirect-tag`, another thread) changes `modules/analytics/src/next/channel.ts`
  and auth's redirects; keep the analytics edit small and merge master when it lands.
- English-only code; user-facing copy only in the `en`/`pl` message dictionaries.
- No release, tag or publish (owner).

## Notes

- Lane B, after FU-4 (merged as #52).
- Framing skipped: a recorded gap with a stated outcome and no premise to test; research answers the
  three unknowns and the double opt-in channel question.
