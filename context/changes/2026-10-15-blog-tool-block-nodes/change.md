---
change_id: blog-tool-block-nodes
title: "Tool blocks return data, load their island lazily, append to the static HTML and share one directive (issue #509)"
status: open
roadmap_item: null
issue: 509
branch: claude/project-thread-9j1p4l
created: 2026-10-15
updated: 2026-10-15
---

## Intent

An app with several article tools behind one directive (`::tool{type="…"}`) moves onto the package's tool blocks:
the config graph (edge proxy, CLI) imports no React, an article without a tool loads no tool code, a tool may add
its fields next to a static chart that stays on the page, and one directive picks among registered tools.

## Context

- Issue #509 (labels `enhancement`, `pkg: blog`, `adoption`), follow-up of #413 (tool blocks, blog 0.2.0).

## Constraints

- Owns `modules/blog/`. No change to any adopting app; the migration goes into the CHANGELOG, the README and the
  issue's closing comment.
- Breaking within 0.x is allowed (the tool block API shipped in 0.2.0 and the adopting app has not moved onto it);
  the CHANGELOG says how to migrate. No release in this change; the coordinator releases.
- Everything in English.

## Notes

- Framing: skipped. The issue names the problem and the four asks.
