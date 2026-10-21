---
change_id: guarded-page-fetch-636
title: "security: fetchGuardedPage and htmlToReadableText (issue #636)"
status: archived
roadmap_item: null
issue: 636
branch: claude/project-thread-ygrs09
created: 2026-10-21
updated: 2026-10-21
archived_at: 2026-10-21
---

## Intent

Close [issue #636](https://github.com/SOFTURE/AI/issues/636): apps that keep links a user saved (bookmarks,
read-later lists, link previews, page summaries) need the page itself, not only the status `sendGuardedRequest`
returns. Add to `@softure-ai/security/server` a guarded GET that follows redirects (each hop checked by the same
SSRF rules), returns a byte-capped body with its content type and charset, and a pure helper that turns the HTML
into readable text (title, description, main text, links) for a model or a database.

## Context

Labels: `enhancement`, `pkg: security`. Builds on `sendGuardedRequest` (#479, security 0.2.3). The coordinator
keeps `htmlToReadableText` in the security package, so it does not overlap #635 (core). #638 (also security)
starts after this merges. No release in this change: the coordinator releases the batch (CHANGELOG `## Unreleased`).

## Constraints

- `sendGuardedRequest` keeps its behaviour and its tests; the guard (lookup check, literal check, ports,
  `agent: false`) is shared, not copied.
- Every redirect hop is parsed, checked and resolved through the guarded lookup again.
- The body never exceeds `maxBytes` in memory, after decompression too.
- `htmlToReadableText` does no network and runs no script.

## Notes

- Framing: skipped. The issue names the problem and the API.
