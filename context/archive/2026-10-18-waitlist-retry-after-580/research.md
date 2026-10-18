---
change_id: waitlist-retry-after-580
---

# Research: waitlist-retry-after-580

Sources: `modules/waitlist/src/contract.ts` (`WaitlistFormState`), `src/next/actions.ts` (`joinWaitlistAction`),
`src/server/signups.ts` (`joinWaitlist`, `JoinWaitlistResult`), `src/ui/waitlist-form.tsx`, `src/messages/en.ts`,
`modules/security/src/contract.ts` (`RateLimitRejection`), `src/server/rate-limit.ts`, `foundation/core/src/i18n.ts`
(`formatMessage`), tests `next-join.test.tsx`, `waitlist-form.test.tsx`, `messages.test.ts`.

- `joinWaitlist` already returns `RateLimitRejection` (`Err<"security.rate_limited">` plus `retryAfterSeconds`,
  `resetAt`) for both buckets (`waitlist` per client, `waitlist-email` per address). The value is lost only in
  `joinWaitlistAction`, which maps any `!result.ok` to `{ status: "error", error, field?, ...echo }`.
- `retryAfterSeconds` is whole seconds, at least 1 (`Math.max(1, Math.ceil(...))`). The test clock is fixed, so
  with a 15-minute window the second attempt gets exactly 900.
- `WaitlistForm` shows a form-level error through `getWaitlistErrorMessage(messages, code)` into `FormError`.
- Copy with values goes through `formatMessage(template, params)` from `@softure-ai/core` (auth, billing do this).
- App messages are partial dictionaries merged over `en` by the module factory, so a new key does not break an app's
  override; an app with its own translation should add the new key to keep its language.
- `next-join.test.tsx` drives `joinWaitlistAction` with Next mocked; `createTestWaitlist({ buckets })` sets limits.
