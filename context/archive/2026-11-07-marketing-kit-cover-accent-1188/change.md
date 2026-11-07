---
change_id: marketing-kit-cover-accent-1188
title: "marketing-kit: an optional brand accent on the photo cover's kicker and pill (issue #1188)"
status: archived
roadmap_item: null
issue: 1188
branch: claude/project-thread-7cgv7h
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent

Close [#1188](https://github.com/SOFTURE/AI/issues/1188): `renderPhotoCover` never draws `colors.accent`. Add an
opt-in `accent: true`, off by default so every existing cover stays pixel for pixel the same:

- `kicker-title`: the kicker in `colors.accent`, its contrast checked against the scrim colour;
- `pill`: the box in `colors.accent` with the label in `foreground` or `background`, whichever reads better;
- an error (never a drawn cover) when the accent's contrast against what it stands on is under 3:1 (WCAG large text).

## Context

Labels: `pkg: marketing-kit`. The thread releases marketing-kit after the coordinator's go (batched with other
marketing-kit fixes).

## Constraints

- Without `accent` the output is unchanged.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the API, the layouts and the contrast bound.

## Done

`renderPhotoCover({ accent: true })` draws the brand accent: the `kicker-title` kicker in `colors.accent`, or the
`pill` box in the accent with the label in the better-reading of foreground and background; another layout or an
accent under 3:1 against what it stands on is an error. Off by default, so existing covers are unchanged (#1188).
Next marketing-kit release.
