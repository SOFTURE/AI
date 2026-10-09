# Plan review: analytics-waitlist-seo-adoption-gaps-324

Reviewed: `plan.md` against `change.md`, issue #324, `analytics/src/next/route.ts`,
`waitlist/src/server/signups.ts`, `mailing/src/server/suppressions.ts`, `seo/src/proxy/index.ts` and
`seo/src/server/html-to-markdown.ts`.

Verdict: **approve**.

## Findings

### F1 (Warning): the waitlist split needs a mailing release
`findSuppressedAddresses` is new, so waitlist 0.1.10 cannot run on mailing 0.1.11. **Decision:** D1 bumps the
range to `^0.1.12` in `package.json`, `module.json` and the lockfile; mailing 0.1.12 is unreleased and both go out
in the same wave.

### F2 (Warning): a self-origin `Location` would leak the internal address
The render runs on `127.0.0.1`; a redirect copied verbatim sends agents there. **Decision:** D3 resolves the
`Location` against the render URL and moves same-origin targets to the site origin. Tested.

### F3 (Suggestion): `remove` defaulting to `header, footer` drops article headers — rejected
An article's title and byline live in its own `<header>`. **Decision:** D4.

### F4 (Suggestion): memory of a large split
The split reads every confirmed sign-up's address once; waitlists are thousands, not millions, and the addresses
never leave the function. Accepted.
