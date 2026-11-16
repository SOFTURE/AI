---
change_id: booking-documents-gaps
title: "files, pwa, theme-notion: what an app needs to keep documents and show them offline"
status: archived
roadmap_item: null
issue: "#1255, #1256, #1257"
branch: claude/project-thread-4n160z
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An adopting app keeps booking documents (confirmation PDFs, ticket images) beside the entries they belong to and
shows them on a phone, offline, also as an installed iOS app. Three generic pieces are missing in the packages:

1. `@softure-ai/files`: saving a file from an https URL through the guarded download (#1257).
2. `@softure-ai/pwa`: a same-origin kept-files cache that survives builds, filled and pruned by the page within a byte
   budget, served cache first by the worker, cleared on sign-out (#1255).
3. `@softure-ai/theme-notion`: a document viewer that shows a PDF's pages and an image inside the page, and a
   document row (#1256).

## Context

- `@softure-ai/files` 0.4.1 has `saveFile` (stream or path); `@softure-ai/security` 0.2.7 has `downloadGuardedFile`.
- `@softure-ai/pwa` 0.2.0 keeps a build-independent cache only for another origin (`extraOrigins`); `/api/` is an
  excluded prefix by default, and a same-origin file has no kept copy.
- `@softure-ai/theme-notion` 0.16.2 has `UploadField`, `UploadList`, `UploadItem`, `FileInput`; nothing shows a file.

## Constraints

- Each piece is additive and optional: an app that does not use it sees no change. Minor bumps.
- No real document in tests: fictional bytes and PDFs generated in the test.
- The viewer renders a PDF inside the page (no new window, no `<iframe>` of the PDF: an installed iOS app shows only
  its first page there and cannot come back from a new window offline).
- Style only through the theme's tokens and components.

## Notes

- Frame skipped: the adopting app's roadmap item names the three pieces and why they are generic.
