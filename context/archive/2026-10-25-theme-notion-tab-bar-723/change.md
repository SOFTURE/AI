---
change_id: theme-notion-tab-bar-723
title: "theme-notion: TabBar, line tabs as links with icon and count (issue #723)"
status: archived
roadmap_item: null
issue: 723
branch: claude/project-thread-cxwygc
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #723](https://github.com/SOFTURE/AI/issues/723): `@softure-ai/theme-notion` exports `TabBar`, a screen's
tabs drawn as the design system's line tabs where each tab is a link and the shown tab lives in the address. An
adopting app drops its own copy.

## Context

- Labels: `enhancement`, `pkg: theme-notion`, `adoption`. Found while moving the first app onto theme-notion 0.1.1.
- The package's `Tabs` (Radix) keep the shown tab in client state; a server-rendered link row is a different need.

## Constraints

- Identical look to the issue's reference implementation; `data-slot="tab-bar"`, `data-tab`, `tab-bar-count` kept.
- A server component (no `"use client"`), English only, no app-specific code.

## Notes

- Framing: skipped. The issue names the outcome, the API and the reference implementation.
