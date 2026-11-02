# Plan: mcp-access-strict-nullable-919

## Approach
1. Text step: one helper builds `z.preprocess(read, schema)` and gives the step the `optin` of the schema it wraps,
   so a text step never makes a required field look optional, wherever it sits (nullable, union, tuple).
2. Wrapper chains: a wrapper node (`optional`, `nullable`, `default`, `prefault`, `nonoptional`, `readonly`, `catch`)
   whose chain ends at a boolean or number gets the text step around the whole chain, so `default` and `prefault`
   stay listed and an absent field still gets its default (the step passes `undefined` through).
3. A tool registered without an input schema gets the strict empty object and its callback is still called with the
   request context only; `tools/call` with any argument is refused with the unknown-fields text.
4. `renamedFields` takes a map or a function `(field) => newName | undefined`.
5. Tests (new `tests/strict-tool-input-919.test.ts`): the issue's reproduction, defaults listed, unions, the parse
   rule unchanged, the empty-schema tool through `tools/call` and `tools/list`, the rename function. README and the
   `Unreleased` changelog entry with the migration.

## Decisions (auto)
- D1 Copy `optin` onto the step (the issue's proposal) instead of only hoisting: it also covers unions and tuples.
- D2 The empty-schema tool lists `additionalProperties: false`, which changes the tool list version an app
  measures; noted in the changelog. A tool that wants arguments declares a schema.
- D3 A rename function wins over nothing else: the option is one value, map or function, normalised to a function.

## Progress
- [x] Phase 1: strict-input.ts (steps 1-4) (e3195d0)
- [x] Phase 2: tests, README, changelog, gates (67afde2)
