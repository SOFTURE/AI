---
change_id: theme-notion-upload-field-950
status: in_progress
---

# Plan: upload field (issue #950)

Input: change.md, research.md. Complexity: medium (one package, three components and a helper).

## Phase 1: components and tests (TDD)

Files: `themes/theme-notion/src/notion/Upload.tsx`, `src/messages/en.ts`, `src/index.ts`,
`tests/notion/Upload.test.tsx`, `tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`, visual baselines.

- `formatFileSize(bytes, locale = "en")`.
- `UploadField({ label, description?, error?, accept?, multiple?, capture?, disabled?, onFilesSelected,
  onFilesRejected?, messages?, id?, className? })`.
- `UploadList({ label, children, className? })`: an `ul` with the accessible name.
- `UploadItem({ item, onRetry?, onRemove?, onPause?, onResume?, locale?, messages? })` with
  `UploadFileItem = { id, name, size, state, progress?, error? }` and
  `UploadState = "queued" | "uploading" | "paused" | "done" | "failed"`.
- Tests: pick, drop with and without `multiple`, `accept` filtering and rejection, input cleared, drag highlight,
  each state's word and progress, retry/remove/pause/resume callbacks with the item, message overrides, size format
  per locale and boundaries (0, 999, 1000, non-finite).

## Phase 2: docs

README section and the component list, `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Option 2 of the research: three controlled parts.
- Pause and Resume buttons are optional callbacks, since #949 makes uploads resumable.
- Decimal size steps (kB, MB, GB), the unit names `Intl` writes.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: components and tests
- [ ] Phase 2: docs
- [ ] Implementation review
