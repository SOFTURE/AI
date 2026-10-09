# Implementation review: analytics-waitlist-seo-adoption-gaps-324

Reviewed: the branch diff against `plan.md`.

Verdict: **approve**.

- Each new test failed on master for the expected reason (analytics 503 instead of 204/200; waitlist missing
  `active`/`suppressed`; mailing `findSuppressedAddresses` not a function; seo `null` instead of a redirect or a
  404 answer, header kept inside the wrapper) and passes with the change.
- `createFunnelRoute()` without options still reads the registered config; the existing next and endpoint tests
  pass unchanged.
- `countSignupsByChannel(ctx)` keeps its order and type; the split sorts with the same comparator.
- Removed seo cases ("leaves a redirect / a missing page to the page") were replaced by tests of the new
  behaviour; 500 and non-HTML still answer `null`.
- `getPublicLocation` drops nothing but the origin of a same-origin target (path, query and fragment kept).
- Docs, CHANGELOGs and versions agree (analytics 0.1.11, waitlist 0.1.10, seo 0.1.8, mailing 0.1.12 entry).
- No Polish outside dictionaries; no raw colours touched.
