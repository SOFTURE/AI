# Plan: analytics-waitlist-seo-adoption-gaps-324

## Approach

1. Tests first, each failing on master:
   - analytics `tests/adoption-gaps-324.test.ts`: a beacon and a pixel counted in the handed-in context (503 on
     master, which reads the mocked registered config); a failing `getContext` answers 503 `no-store`.
   - mailing `tests/suppressions.test.ts`: `findSuppressedAddresses` over 1203 addresses (more than one batch),
     addresses returned as given; a dropped table throws.
   - waitlist `tests/adoption-gaps-324.test.ts`: per-channel `active`/`suppressed`, an address suppressed in
     another spelling matches, an empty list.
   - seo `tests/page-markdown.test.ts`: redirects (relative, self-origin, other-site `Location`; all five
     statuses), a redirect without `Location`, 404 and 410 pages; `tests/html-to-markdown.test.ts`: header and
     footer inside a layout wrapper dropped, a section's own kept.
2. analytics `src/next/route.ts`: `FunnelRouteOptions.getContext`, default `getAnalyticsContext()`.
3. mailing `src/server/suppressions.ts`: `findSuppressedAddresses(ctx, addresses)`, keys by `getRecipientKey`,
   `IN` queries of 500 keys.
4. waitlist `src/server/signups.ts`: overloads of `countSignupsByChannel`; the split reads confirmed
   `(email, channel)` rows and asks mailing which addresses are suppressed. Dependency on mailing `^0.1.12`.
5. seo `src/proxy/index.ts`: redirect statuses answered with `getPublicLocation`; 200/404/410 HTML converted with
   the page's status. `src/server/html-to-markdown.ts`: drop `header, footer` not held by article/section/aside.
6. READMEs, CHANGELOGs, versions in `package.json`, `module.json` and `package-lock.json`.

## Decisions (auto)

- **D1: the split goes through a new mailing function, not SQL on mailing's tables.** The issue's complaint is
  exactly an app reading `mailing.suppressions`. Using the 0.1.12 SQL view in a join would also work, but a
  JS-side key match through `findSuppressedAddresses` keeps the waitlist on mailing's TypeScript API and matches
  `getRecipientKey` exactly (the SQL function differs under the C locale). Folded into the unreleased mailing
  0.1.12; waitlist requires `^0.1.12`.
- **D2: overloads, not optional fields.** `splitSuppressed: true` returns `SuppressedSplitChannelCount[]`
  (`signups`, `active`, `suppressed`); without it the type stays `ChannelCount[]`.
- **D3: translate, not only document.** A redirect keeps its status and gets the public-origin `Location`;
  another site's `Location` is kept; no `Location` falls back to the page. 404 and 410 HTML pages answer their
  `<main>` as Markdown (no hard-coded "not found" copy). 5xx stays with the page.
- **D4: header/footer by sectioning ancestor.** Instead of making `remove` default to `header, footer` (which
  would drop an article's own header), a header or footer is dropped unless an article, section or aside within
  the root holds it.

## Progress

- [x] 1. Failing tests (analytics 1, waitlist 1 + typecheck, mailing 2, seo 6 failed on master)
- [x] 2. analytics
- [x] 3. mailing
- [x] 4. waitlist
- [x] 5. seo
- [x] 6. Docs, CHANGELOGs, versions
