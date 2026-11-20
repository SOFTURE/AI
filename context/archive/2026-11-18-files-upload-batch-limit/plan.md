# Plan: files-upload-batch-limit

One phase, TDD: a test in `modules/files/tests/uploads.test.ts` with the default options (twenty sessions open, the
next refused, an expired one frees a slot, the quota still refuses) fails on the current default of 5; then
`maxOpenPerOwner` defaults to 20 in `src/options.ts` (field default and the object default), the defaults test in
`tests/module.test.ts`, the README table and CHANGELOG follow, version bumped as a patch.

Done when: typecheck, lint and the files package's tests are green; the new test failed before the change.

## Progress

- [x] Phase 1: failing test (failed on the default of 5: "setup: files.too_many_uploads" at the sixth session), default 20, README, CHANGELOG, version 0.6.1 (on top of 0.6.0 from #1379). Files package tests 244 + 2 green; typecheck, lint, language gate green.
