---
change_id: theme-notion-upload-field-950
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Ask 1 (`UploadField`, native input, `accept`/`multiple`/`capture`, touch target, keyboard, drop as a bonus):
  Phase 1; the button is a real `Button` of touch size, the hint for dropping is hidden below `md`.
- Ask 2 (`UploadList`/`UploadItem`, five states, progress, message and Retry, Remove, `Status` tones): Phase 1.
- Ask 3 (controlled, transport-free, `onFilesSelected`, `onRetry`, `onRemove`): the parts hold no upload state.
- Ask 4 (`upload.*` copy, sizes by locale): `en.upload` plus a `messages` prop, `formatFileSize` with `Intl`.
- Risk: a drop of a folder hands over an entry with size 0 and no type; it is passed on like any file and the
  transport reports it. Accepted.
- Risk: `accept` matching on drop is by extension and MIME type only, like the browser's own picker. Accepted.

Verdict: approved, no changes.
