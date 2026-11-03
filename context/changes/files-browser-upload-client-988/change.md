---
change_id: files-browser-upload-client-988
title: "files: a browser client that sends a File to an upload session, with a queue for upload lists (issue #988)"
status: plan_reviewed
roadmap_item: null
issue: 988
branch: claude/project-thread-mfa92k
created: 2026-11-03
updated: 2026-11-03
archived_at: null
---

## Intent

Close [issue #988](https://github.com/SOFTURE/AI/issues/988): an app with its own upload screen sends a browser `File`
to a `@softure-ai/files` upload session through the package, not through a chunk loop of its own. A browser entry
`@softure-ai/files/client` gives `sendUpload` (reads the session's `HEAD`, sends only the missing chunks in order,
reports progress, honours an `AbortSignal`, answers a `Result` with typed codes) and a small framework-free queue that
keeps an upload list shaped for theme-notion's `UploadItem` (queued, uploading, paused, done, failed) with `add`,
`retry`, `pause`, `resume` and `remove`. The package's own upload page uses the same sender.

## Context

Labels: `enhancement`, `pkg: files`. Builds on the upload sessions of #949 (files 0.2.0) and the transport-free
`UploadField` / `UploadItem` of #950 (theme-notion 0.11.0). Issue #987 (a hook after `finalizeUpload`) runs in a
parallel thread and also touches `modules/files/CHANGELOG.md`. No release in this change: CHANGELOG `## Unreleased`.

## Constraints

- The route, the wire protocol and the server session lifecycle do not change.
- The client entry runs in a browser: no Node built-ins, no server code, no React dependency.
- English only; user-visible copy comes from the module dictionary and stays overridable.
- Owns: `modules/files/src/client/`, `modules/files/src/server/upload-page.ts`, the files messages, README, CHANGELOG,
  `package.json` exports, new tests under `modules/files/tests/`.

## Notes

- Framing: skipped. The issue names the problem, the API shape and what is out of scope.
