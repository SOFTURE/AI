# Frame: auth-require-user-redirect-tag

## Request as stated
Roadmap FU-31: a page that calls `requireUser()` while it renders sends a visitor without a session to login at a URL
that keeps the page's channel tag.

## Observation, premise, direction
- Observation: an anonymous `/payment?plan=monthly&z=ads` answers `307 Location: /login?next=%2Fpayment%3Fplan%3Dmonthly`;
  the login, the sign-up after it and the payment page after login all land without the channel (research, Summary).
- Premise: the redirect bypasses `rewriteRedirect` and has no page parameters to give it.
- Direction: a `searchParams` option on `requireUser`, and the redirect through `resolveRedirectTarget`.

## Premise check
- Do nothing: a campaign link to a plan (`/payment?plan=…&z=newsletter`) is the most valuable tagged link a product
  sends, and the visitor is usually signed out; their sign-up and payment would count under no channel.
- Already solved elsewhere: the guard plus `carry` for guarded prefixes only; billing's payment page is a module page an app mounts
  at a route of its choice, linked from the public pricing page, and nothing makes the app guard it (the example does
  not). A documented rule helps only apps that read it; the option works for every page that passes its parameters.
- Smallest proof: one e2e reading the `Location` of the anonymous payment page.

## Hypotheses
| Where it could come from | Expected evidence | Found | Verdict |
|---|---|---|---|
| `requireUser` calls `redirect()` past the rewrite | direct `redirect(...)` | `current-user.ts:35` | STRONG |
| The proxy re-tags the follow-up login request | `tag` reads a tagged same-origin `Referer` | the follow-up keeps the navigation's original `Referer` (none for a typed URL or an ad) | NONE |

## Framings
| Option | What we build | Cost vs as-asked | Risk |
|---|---|---|---|
| Proceed | `requireUser({ next, searchParams })`, redirect through the rewrite; `PaymentPage` passes its params | as asked (small) | low |
| Shrink | a README rule only | none | `/payment` stays untagged |
| Reframe | analytics wraps `requireUser` | auth's helper duplicated in analytics | two helpers for one check |
| Kill / defer | keep the README limitation | none | campaign links to a plan lose the channel |

## Recommendation
Proceed. Callers without parameters also go through the rewrite (an action's `Referer` is right; a render's matches
what the proxy tags), so most calls improve without a change and pages that receive `searchParams` pass them.
