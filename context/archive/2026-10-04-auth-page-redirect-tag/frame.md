# Frame: auth-page-redirect-tag

## Request as stated
Roadmap FU-28: auth's login and register pages redirect a signed-in visitor to a URL that keeps the page's own channel tag.

## Observation, premise, direction
- Observation: a signed-in visitor who opens `/login?z=ads` with a full page load is answered `307 Location: /account`;
  the account page renders and counts its beacon without a channel (research, Summary).
- Stated cause or premise: the page's `redirect(next)` bypasses `rewriteRedirect`, and `tagRedirect` could not read
  the page's URL anyway; the views after it are worth attributing.
- Proposed direction: route the page redirect through the same rewrite, given the page's search parameters.

## Premise check
- Do nothing for 3 months: returning visitors who click an ad or newsletter link to the login page are counted
  untagged on the account view; with JavaScript `<ChannelKeeper />` cannot help (the tag is gone from the URL before
  the browser renders anything). The sign-up step is unaffected (they already have an account).
- Evidence (frequency, data): no traffic yet (no app is released); a "sign in" link in a campaign mail is the common
  case for returning users, so the path is a normal one, not an anecdote.
- Already solved elsewhere: the proxy's `tag` cannot (the request already carries the tag; the redirect happens in the
  render); `carry` wraps only proxy pieces. FU-7's seam solves it for actions.
- Smallest proof: one e2e that opens a tagged login page signed in and reads the `Location`.

## Hypotheses
| Where it could come from | Expected evidence | Found | Verdict |
|---|---|---|---|
| The page's `redirect(next)` ignores the rewrite | `pages.tsx` calls `redirect(next)` directly | `modules/auth/src/next/pages.tsx:52,73` | STRONG |
| The browser's follow-up loses the tag through `Referer` | follow-up `Referer` is the page before | redirects keep the original navigation's referrer; research Summary | STRONG |
| The proxy could re-tag the follow-up | `tag` needs a tagged same-origin `Referer` | the `Referer` is not the tagged page | NONE |
Pressure test: blind search for `redirect(` in auth's pages → the two signed-in redirects plus `requireUser`
(no page parameters; separate gap); prior occurrences → FU-7 (same cause for actions); inverse check → an action redirect
from the same page is tagged today (e2e "the sign-up action answers with the tagged account page").

## Framings
| Option | What we build | Cost vs as-asked | Risk |
|---|---|---|---|
| Proceed | page redirects through `resolveRedirectTarget` with the page's parameters; `tagRedirect` reads them | as asked (small) | low |
| Shrink | only `LoginPage` | marginally cheaper | leaves the same hole in `RegisterPage` |
| Reframe | a separate page-level helper in analytics the app wires as a second option | more API, same code | two options for one concept |
| Kill / defer | leave the README limitation | none | campaign links to login stay untagged after login |

## Decision
Proceed, because the FU-7 seam already exists and the extra context field is the cheapest correct fix for both pages.
Confidence: HIGH.
Problem to plan around: a page render cannot tag its redirect without its own search parameters.
Scope now: `LoginPage` and `RegisterPage` signed-in redirects; `tagRedirect` reading page parameters; docs; tests.
Out of scope now: `requireUser`'s render redirect to login (gap for followups).
What changes for the plan: nothing beyond the roadmap outcome; the rewrite context gains optional search parameters.
