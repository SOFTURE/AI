---
change_id: core-request-form-676
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: every ask of the issue is met; `connections/src/server/request.ts` is untouched (issue #675 changes it), the
  pass-through is covered by a new test file.
- Finding (fixed in b64c76d): `fakeFetch` decoded the body to text before parsing the form, so a binary file part lost
  bytes to UTF-8 replacement and reported a wrong `size`. It now parses the bytes; a test with a binary part fails
  on the old code and passes now.
- Compatibility: a JSON `body` behaves as before (existing tests unchanged and green); `RequestJsonWriteOptions` is a
  union now, only used in intersections in the repository; the CHANGELOG says what to do for an `extends`.
- Security: nothing new leaves in a failure; the misuse errors name only the kind of value, never its content.
- Gates: typecheck, lint (whole repository), build, package tests of core, testing and connections.

Verdict: approved after the fix.
