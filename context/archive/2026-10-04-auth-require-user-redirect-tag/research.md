# Research: auth-require-user-redirect-tag

Input: change.md, roadmap FU-31. Depth: quick (one auth helper, its callers, the FU-28 seam, no data).
Snapshot: 33be50f on claude/fu-31-require-user-redirect-tag-z0d58o (from master), 2026-10-04 03:25 UTC.

## Summary
- `requireUser({ next })` (`modules/auth/src/next/current-user.ts:30-36`) builds `login[?next=…]` and calls
  `redirect()` itself; the app's `rewriteRedirect` never sees it. In a page's render Next answers that with
  `307 Location: <url>` (FU-28 research, `app-render.js:2386-2390`, Next 16.3.8); in an action with a `303` (no JS) or
  `x-action-redirect`.
- A render cannot read its own URL except through `searchParams` (FU-28 research). So the only way to keep the page's
  tag is for the page to hand its search params to `requireUser`, which hands them to `resolveRedirectTarget` (the
  FU-28 seam), where analytics' `tagRedirect` already prefers them over `Referer`.
- Callers that pass no parameters: in an action, `rewriteRedirect` with `{ config }` reads the `Referer`, which is the
  page the action was posted from (the FU-7 semantics, correct). In a render, the `Referer` is the page before; the
  proxy's `tag` already re-tags a navigation from a tagged page with that same `Referer`, so the result matches the
  proxy, except when the page's URL has its own, different tag (the older one would win).
- The guard-free page that matters inside this repository: billing's `PaymentPage` (`/payment`, linked from the
  public pricing page, `modules/billing/src/next/pages.tsx:60-65`), which receives `searchParams`. The other module
  pages that call `requireUser` (auth's change password, privacy's account page, mcp-access's token page) take no
  props and live under guarded prefixes in the example (`/account`; the guard always adds `routes.changePassword`).

## Current state
- `requireUser` callers: `modules/auth/src/next/pages.tsx:117` (ChangePasswordPage), `modules/billing/src/next/pages.tsx:65`
  (PaymentPage), `modules/billing/src/next/actions.ts:44` (startPaymentAction), `modules/billing/src/next/current-entitlement.ts:31`
  (`requireWriteAccess(options: RequireUserOptions)`), `modules/mcp-access/src/next/pages.tsx:58`, `modules/privacy/src/next/pages.tsx:19`,
  and the example's `/account/*` pages.
- `resolveRedirectTarget(config, path, searchParams?: URLSearchParams)` (`modules/auth/src/redirect-target.ts`).
- `pages.tsx:50-56` has `readSearchParams(promise)` → `URLSearchParams` (every value of a repeated name).
- Analytics `tagRedirect(path, { config, searchParams? })` (`modules/analytics/src/next/channel.ts`); `tagPath` appends
  the tag to a path that has a query (`/login?next=%2Fpayment` → `/login?next=%2Fpayment&z=ads`) and leaves a path
  with its own tag alone.
- After login, the login action's redirect to `next` is tagged from the login page's `Referer` (FU-7), so a tagged
  login URL is enough for the visitor to land back on the tagged page.
- Example e2e: `examples/next-app/e2e/analytics-channel.spec.ts` ("the auth guard's redirect to login keeps the tag");
  `billing-pricing.spec.ts` opens `/payment` anonymously only via `register` first (no assertion on the untagged URL).

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Auth helper | `modules/auth/src/next/current-user.ts`, new `src/next/search-params.ts`, `src/next/pages.tsx`, `src/next/index.ts` | option `searchParams`, redirect through the rewrite, shared conversion |
| Billing page | `modules/billing/src/next/pages.tsx` | `PaymentPage` hands its parameters over |
| Tests | new `modules/auth/tests/require-user.test.ts`; `examples/next-app/e2e/analytics-channel.spec.ts` | unit and e2e proof |
| Docs | `modules/auth/README.md` (usage, options row), `modules/analytics/README.md` §1, §3, §12 | the gap closes |

## Data
None.

## Tests
- Unit: `role-checks.test.ts` pattern (mock `@softure-ai/core/next`, `next/headers`, `../src/next/context.ts`); the real
  `next/navigation` `redirect()` throws an error whose `digest` is `NEXT_REDIRECT;replace;<url>;307;`.
- e2e: anonymous `page.goto("/payment?plan=monthly&z=…")`, read the `307` through `redirectedFrom()` (FU-28 helper),
  then log in and land on the tagged payment page.

## Patterns to follow
- FU-28: page parameters as `URLSearchParams`, the rewrite's result through `toSafeNextPath`, failure logged.

## Prior work
- [`archive/2026-10-04-auth-page-redirect-tag/`](../../archive/2026-10-04-auth-page-redirect-tag/change.md) (FU-28).
- [`archive/2026-10-03-analytics-action-redirect-tag/`](../../archive/2026-10-03-analytics-action-redirect-tag/change.md) (FU-7).

## SOFTURE modules
Auth and analytics only; nothing generic to reuse beyond them.

## Open questions
- None blocking. A rule "pages with `requireUser` sit behind the guard" depends on every app's proxy config (the example
  does not guard `/payment`), so the option is the robust fix; the README still recommends the guard.
