---
change_id: deploy-verify-header-starts-with-441
title: "deploy: a verify header check anchored at the start of the value (issue #441)"
status: open
roadmap_item: null
issue: 441
branch: claude/project-thread-ehm4x2
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #441](https://github.com/SOFTURE/AI/issues/441) (labels `enhancement`, `pkg: deploy`): a verify header
check is a case-insensitive substring, so a value that only means something at a fixed position (a Web Bot Auth
`signature-input` that must start with `binding0=("@authority";req)`) also passes when the text appears later in the
value. A header check gains an object form `{ "startsWith": "<text>" }` next to the string, list and null forms.

## Context

deploy is at 0.1.11 on master. Issue #434 (`warnOn`, PR #444) changes the same files (`schema.ts`, the schema file,
README, CHANGELOG) and merges first; this branch merges master in once it lands. Releases are batched by the
coordinator: no version bump, the CHANGELOG gets `## Unreleased`.

## Constraints

- Additive: a plain string keeps its substring meaning, so existing configs do not change.
- The JSON schema file is regenerated with the package's own script, never by hand.

## Notes

- Framing: skipped. The issue states the problem and the proposed shape.

## Decisions (auto)

- Shape as proposed: a strict object `{ startsWith: string }` (non-empty), so later forms (`equals`, `endsWith`) can
  join it without changing the config.
- Case-insensitive, like the string form: one rule for every header check.
- The object form is allowed as a list item too, so one header can carry an anchored check and substrings.
- No version bump; `## Unreleased` in the CHANGELOG.
