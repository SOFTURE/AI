---
change_id: mcp-access-issue-token-386
title: "mcp-access: issueToken can replace an app's own issue action (issue #386)"
status: archived
roadmap_item: null
issue: 386
branch: claude/project-thread-9ftb3e
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #386](https://github.com/SOFTURE/AI/issues/386) (labels `enhancement`, `adoption`, `pkg: mcp-access`):
three gaps that keep an adopting app on its own token-issue action instead of `issueToken` (`/next`).

1. `mcpAccess({ clientServerName })`, default `serverName`: the name the setup snippets (`claude mcp add`, the JSON
   configs, the assistant prompt) register the server under, so an app keeps the name its users already added.
2. The `beforeIssue` gate may refuse with the app's own text: `refuseIssue(code, message)` (`/next`), or a thrown
   `PublicError` (core) whose message becomes the form error. The form state carries the text next to the code.
3. `IssuedToken.expiresAt` (ISO 8601) next to `expiresText`.

A reviewer checks `modules/mcp-access/tests/adoption-gaps-386.test.ts`, the README and the CHANGELOG `Unreleased` entry.

## Context

mcp-access is at 0.1.13 on master. Releases are batched by the coordinator, so this change bumps no version: the
CHANGELOG gets an `## Unreleased` section.

## Constraints

- Additive only: an app that passes none of the new options sees the same setup, codes and copy.
- A thrown error other than a `PublicError` still becomes a safe code; its text never reaches the page.

## Process notes

- Framing: skipped. The issue states each gap, its cause and a proposal.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- The app's text rides as an optional `message` on the existing `status: "error"` branch of `IssueTokenFormState`
  rather than a new status, so an app that renders the state itself keeps working; `TokenManager` shows
  `message` before the code's copy.
- A thrown `PublicError` maps to `mcp-access.issue_refused` plus its message (the generic code is the fallback for an
  app that renders codes only).
- `McpClientSetup.serverName` keeps its name and now holds the client-side name.
- The issue proposed `err({ code, message })`; core's `err` takes only a namespaced code, so the gate returns
  `refuseIssue(code, message)`, an `Err<McpIssueRefusalCode>` with a `message` field. It stays a plain `Err` for code
  that checks `ok`, and core is untouched.
