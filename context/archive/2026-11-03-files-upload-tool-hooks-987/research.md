---
change_id: files-upload-tool-hooks-987
---

# Research: files-upload-tool-hooks-987

## Findings

- `modules/files/src/mcp/index.ts` (0.2.0): descriptions are module constants (`CREATE_UPLOAD_DESCRIPTION`,
  `FINALIZE_UPLOAD_DESCRIPTION`), not exported; `finalize_upload` answers `describeStoredFile(file)` and nothing else.
  The issue is accurate: an app can only change either by wrapping `registerTool`.
- `answer()` already maps a `{ ok: false, error }` value to `<files sentence> (<code>)` through
  `getFilesErrorMessage`, which turns any non-`files.*` code into the generic "Something went wrong. Try again.", so
  an app's own code (`assets.quota_exceeded`) would lose its meaning today; a thrown error answers the generic text and
  logs `errorLogLabel(error)`. Both paths are reusable for the hook.
- `finalizeUpload` is idempotent (a repeated call answers the same `StoredFile`), so a hook that runs on every
  successful finalize also runs on a repeat; the app must make it idempotent (e.g. upsert by `file.id`).
- `ErrorCode` in `@softure-ai/core` is `${string}.${string}`; `err()`/`Result` are exported from core and already a
  dependency of files.
- Other packages with app hooks (`billing` events, `jobs` handlers) pass the context and let errors propagate to the
  caller; here the caller is the MCP tool, so the tool's own error rules apply.

## Options

1. **Options on `registerFileUploadTools`** (the issue's proposal): `onFinalized`, `descriptions`, `hints`. Small,
   additive, keeps the app off the tool internals. Chosen.
2. A `describe(name, defaultText)` callback instead of a map: more flexible but the exported defaults give the same
   power (`PREFIX + FILE_UPLOAD_TOOL_DESCRIPTIONS.finalize_upload`) with plainer types. Not taken.
3. Export the handlers so the app composes its own tools: moves the protocol into every app. Rejected.
