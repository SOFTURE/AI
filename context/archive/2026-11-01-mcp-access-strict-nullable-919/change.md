---
change_id: mcp-access-strict-nullable-919
title: "mcp-access: strict tool input keeps required nullable scalars required (issue #919)"
status: archived
roadmap_item: null
issue: 919
branch: claude/project-thread-65s1fl
created: 2026-11-01
updated: 2026-11-01
---

## Intent
#919 (`bug`, `pkg: mcp-access`): `withStrictToolInput` / `toStrictToolInput` wrap every boolean and number field in a
text step (`z.preprocess`). zod 4 treats a transform's input as optional, and `nullable` takes its optionality from
the inner type, so a required `z.number().nullable()` or `z.boolean().nullable()` field leaves `required` in the listed
JSON Schema while the parse still requires it. A field with a `default` around a scalar loses its `default` in the
listing. Two smaller gaps: a tool registered without an input schema accepts any arguments, and `renamedFields` is a
fixed map only.

## Context
`modules/mcp-access/src/server/strict-input.ts` (`StrictRewriter`, `withStrictToolInput`), its tests
`tests/strict-tool-input-876.test.ts`, README "Strict tool input", CHANGELOG.

## Constraints
- The parse rules stay as they are: the same inputs pass and fail.
- The listed schema of a strict tool matches the original one (types, `required`, `default`), plus
  `additionalProperties: false`.
- No change to the app repository; no release in this change (the coordinator batches it).

## Notes
- Framing skipped: the issue carries the reproduction, the cause and the acceptance.

## Done
- The text step takes the optionality of the schema it wraps and goes around a scalar's whole wrapper chain: a
  required nullable boolean or number stays in `required`, and a scalar's `default`/`prefault` is listed.
- A tool registered without an input schema gets the strict empty object; the handler still gets the context only.
- `renamedFields` takes a map or a rule; `RenamedFields` exported from `/server`.
- Tests: `tests/strict-tool-input-919.test.ts`; README "Strict tool input"; CHANGELOG `Unreleased`.
- Release: next batch release (`mcp-access` patch).
