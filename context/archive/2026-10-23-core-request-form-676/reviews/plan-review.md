---
change_id: core-request-form-676
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `http-json.ts`, `request.ts` and `fake-fetch.ts` on master.

- Scope matches the issue's asks: `form` option, exclusive types, multipart boundary left to `fetch`, the `body`
  guard, pass-through in `connections`, recording in `fakeFetch`. The optional migration of `postForm` and Stripe is
  deferred with a reason.
- Compatibility: `RequestJsonWriteOptions` turns from an interface into a union; it is only used in intersections
  (checked in the repository), and a JSON write type-checks as before. The new `body` guard only throws for values
  that were silently sent as `{}` (or as a typed array's indices), which never reached a provider correctly.
- Parallel work: #675 edits `connections/src/server/request.ts`; this plan does not touch it, so the merge is limited
  to the tests file at most.
- Security: no new header or value leaves in a failure; the content-type handling cannot leak anything.
- Edge cases covered: a caller's content-type in both forms, a retried OAuth call, empty forms are valid bodies,
  GET with form, both options at once.

Verdict: approved, no changes.
