---
change_id: theme-notion-upload-field-950
verdict: approved
---

# Implementation review

Reviewed the diff of 39e3115 and 4b9acd8 against plan.md and issue #950.

- Ask 1: `UploadField` frames a native `<input type="file">` (visually hidden, out of the tab order, labelled by the
  `FieldLabel`) behind a `Button` of size `touch` (`md:h-7`); `accept`, `multiple`, `capture` pass through; the drop
  hint is hidden below `md`; dropping is filtered by `accept` and trimmed to one file without `multiple`.
- Ask 2: `UploadList` is a named `ul`; `UploadItem` draws the five states with `Status` colours and words, a
  determinate `Progress` (orange while paused) and the error, which also describes the Retry button.
- Ask 3: no upload state; every button calls back with the item.
- Ask 4: `notionMessages.en.upload`, `messages` overrides, `formatFileSize` by `locale` (default `en`, so server and
  browser agree).
- Tests: 34 component tests (pick, drop, accept, rejection, disabled, description and error wiring, each state,
  clamping, callbacks, overrides, locale, server render), message-layer cases for every `upload.*` text, slot fixture,
  gallery baselines in four projects with axe clean. Gates: typecheck, lint, theme-notion tests (1087), visual (144).
- Checked: hooks are called unconditionally; the drag highlight ends on a drop and on leaving the area, not on moving
  over a child.

Verdict: approved, no changes.
