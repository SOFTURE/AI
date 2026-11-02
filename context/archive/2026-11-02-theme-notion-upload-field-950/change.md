---
change_id: theme-notion-upload-field-950
title: "theme-notion: an upload field with pick or drop, per-file progress and retry (issue #950)"
status: archived
archived_at: 2026-11-02
roadmap_item: null
issue: [950]
branch: claude/project-thread-vhxdaw
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #950](https://github.com/SOFTURE/AI/issues/950): the theme has `Input`, `Field`, `Progress` and `Empty`
but no file upload control, so every app that sends files from a phone builds its own picker, drop area, per-file
progress, error and retry states. Ship `UploadField`, `UploadList` and `UploadItem`: controlled, transport-free,
touch sized, keyboard and screen-reader usable, with copy through `notionMessages` (`upload.*`) and sizes formatted
by the locale.

## Context

Labels: `enhancement`, `pkg: theme-notion`. Soft dependency on #949 (`@softure-ai/files`, resumable uploads): the
components take items and callbacks only, so #949 (or the app) drives them without either package depending on the
other. Checked first that no other session shipped it: no upload component on master (c9380e5), none in the
NOTION · Design System artifact bundle, no open or merged pull request for #950.

## Constraints

- Backwards compatible: new exports and a new `upload` key in the English dictionary only.
- No transport, no state of its own beyond the drag highlight.
- No version bump: the package joins the coordinator's batched release.
- The design system artifact is synced after the merge.

## Notes

- Framing: skipped. The issue names the parts, the states and the callbacks.
