---
change_id: files-upload-tool-hooks-987
verdict: approved
---

# Implementation review: files-upload-tool-hooks-987

- All three asks of #987 implemented as planned: `onFinalized`, `descriptions` (defaults exported as
  `FILE_UPLOAD_TOOL_DESCRIPTIONS`), `hints`. No change to the route, the protocol or `finalizeUpload`.
- Compatibility: the package itself only answers `files.*` codes (`FilesErrorCode`), so the new "code alone" branch
  for other modules' codes cannot change a 0.2.0 answer; a test pins the default answer's keys and descriptions.
- Errors: a hook `err` goes through the same `isFailure` check as the package's results; a throw is caught by
  `answer()`, logged with `errorLogLabel` and answered generically (test asserts the secret text does not leak).
- The hook gets the same `ctx` the finalize used (asserted), and runs on a repeat finalize (asserted: twice, same id).
- Hint lookup uses `Object.hasOwn`, so `constructor` or `__proto__` codes do not hit prototype keys.
- Docs: README §4.2 example and option rules; CHANGELOG `Unreleased` with the migration for a wrapping app.
- No findings. Approved.
