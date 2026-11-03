---
change_id: files-upload-tool-hooks-987
verdict: approved
---

# Plan review: files-upload-tool-hooks-987

- Covers all three asks of #987; scope matches change.md (the MCP adapter only, no route or protocol change).
- Compatibility: every option is optional and the defaults reproduce 0.2.0 exactly; a test pins that answer.
- Error rules stay those of the tool: a returned code is a failure with its text, a throw is logged and answered
  generically, so no app internals leak. The hint lookup is a plain own-property read (no prototype keys).
- Idempotence: a hook on repeated finalizes is what the issue asks; the docs put the burden on the app explicitly.
- Type `FileFinalizedAnswer` mixes a record and `Err`: the check is the existing `isFailure` (`ok === false` and a
  string `error`); a record that happens to carry `ok: false` would be read as a failure. Acceptable and documented.
- Approved without changes.
