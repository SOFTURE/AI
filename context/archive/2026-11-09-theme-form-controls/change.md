---
change_id: theme-form-controls
title: "theme-notion: a compact file input, a form grid that lines up its fields, one control height"
status: archived
roadmap_item: null
issue: null
branch: claude/theme-notion-form-controls
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09
---

## Intent

An adopting app's settings forms look misaligned: the native `<input type="file">` inside `Input` draws the
browser's own English button and "no file selected" text at another height than the other controls, and in a
two-column form each field's label, control and hint sit at different heights when a label or hint wraps in one
column only. The theme gets a compact file input whose copy comes through props, and a form grid that lines label,
control and hint up across columns; forms use one control height (28 px).

## Context

The owner asked for the fix in the theme package, without an issue (an adopting app's UI pass, 2026-11-09). The
existing `UploadField` is a dropping area for many files, too large for a form row that picks one font or logo.

## Constraints

- New exports only; no class of an existing component changes (no upstream delta, no baseline moves).
- Copy through `notionMessages.en.fileInput`, replaced by `messages`.
- The file input stays a real `<input type="file">`: the field label opens it, the keyboard focuses it, tests can
  upload to it.

## Notes

- Framing: skipped. The owner named the problem and the fix.

## Done

`@softure-ai/theme-notion` 0.15.0: `FileInput` (a 28 px button and the chosen file's name, copy in
`notionMessages.en.fileInput`, the native input focusable and labelled) and `FormGrid` (`columns` 1–3, `rows` per
field; label, control and hint share rows across the columns through CSS subgrid). README: the form rule, controls at
their default size.
