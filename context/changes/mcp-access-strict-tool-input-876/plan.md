---
change_id: mcp-access-strict-tool-input-876
status: in_progress
---

# Plan: strict tool input (issue #876)

Input: change.md, research.md. Complexity: small (one new server file, dictionary entries, a factory option, docs).

## Phase 1: strict schema and registration wrapper (TDD)

Files: `modules/mcp-access/src/server/strict-input.ts` (new), `src/server/index.ts`, `src/server/server-factory.ts`,
`src/messages/en.ts`, `tests/strict-tool-input-876.test.ts` (new).

- `toStrictToolInput(schema, options)`: rewrites a zod 4 schema bottom-up through the wrapper kinds in research.md;
  every object without its own catchall becomes strict with an error map that answers `unrecognized_keys` with the
  dictionary's text (unknown field and accepted fields, or `input.field_renamed` and the new name when
  `renamedFields[old]` is a field of that object); the object's own error map still answers its other issues.
  `boolean` and `number` become `z.preprocess` of their exact text (`"true"`/`"false"`, a JSON number literal) when
  `coerceTextScalars` is on (default). Registry metadata is copied to every clone. A raw shape becomes `z.object`
  first; a non-zod Standard Schema passes unchanged.
- `withStrictToolInput(server, { renamedFields?, coerceTextScalars?, messages? })`: replaces the instance's
  `registerTool` once (idempotent) so every later registration gets the strict schema; returns the server.
- `createMcpServerFactory({ strictToolInput: true | options })`: applied to the served and the recording server, so the
  version follows the strict listing.
- Tests through a real `McpServer` + `createMcpHandler` (`tools/call`): unknown field refused at the top, in a nested
  object, an array item, a record value, optional, default, union, discriminated union, intersection and pipe input,
  handler not called; accepted fields named; renamed field code; text scalars converted and other text refused;
  listing keeps `boolean`/`number` with `additionalProperties: false`; descriptions kept; refinements kept; a tool
  registered after wrapping is strict; wrapping twice is harmless; factory option; passthrough objects stay open.

## Phase 2: docs

`modules/mcp-access/README.md` (strict input section), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- A wrapper over the server's `registerTool` instead of a helper per tool: the issue asks for "applied once at
  registration", and a tool added later is strict without the author remembering it.
- `coerceTextScalars` on by default: the issue describes it as part of strict input for clients on an older tool list;
  `false` turns it off.
- Objects with their own catchall (`.passthrough()`, `.catchall(x)`) keep it: the author chose to accept extra keys.
- Text comes from a `toolInput` group in the module dictionary, overridable with `messages` (e.g.
  `getMcpAccessMessages(config).toolInput`).
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: strict schema and registration wrapper
- [ ] Phase 2: docs
- [ ] Implementation review
