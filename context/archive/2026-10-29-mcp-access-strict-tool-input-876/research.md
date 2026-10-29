---
change_id: mcp-access-strict-tool-input-876
---

# Research

- `@modelcontextprotocol/server` 2.3 `registerTool(name, config, cb)` passes `config.inputSchema` through
  `normalizeRawShapeSchema` (a raw zod shape becomes `z.object(shape)`) and stores it. `tools/call` validates the
  arguments with `schema["~standard"].validate(args ?? {})` before the handler and hands the handler the parsed value;
  a failure answers `isError` with `Input validation error: Invalid arguments for tool <name>: <path>: <message>`.
  `tools/list` builds the JSON Schema from `~standard.jsonSchema.input`. So rewriting the zod schema before the original
  `registerTool` covers validation, the handler's input and the listing at once.
- zod 4.6.5: `schema.clone({ ...def, catchall: z.never() })` is how `.strict()` is built; it keeps `def.checks`
  (refinements). A strict object raises one `unrecognized_keys` issue (`keys`, `inst` = the object, path of the object)
  and its message comes from `def.error` first, so a per-object error map can name the accepted keys (`def.shape`).
  Unions report the closest branch's issue, discriminated unions the selected branch's, and intersections report a key
  only when both sides reject it, so strict operands keep working.
- Input JSON Schema of a strict object adds `additionalProperties: false`. A cloned schema loses its registry metadata
  (`.describe()` lives in `z.globalRegistry` per instance), so the description has to be copied to the clone.
- `z.preprocess(fn, z.boolean())` is a pipe whose input side is a transform; the input JSON Schema emitter then uses the
  output side, so the listing keeps `"type": "boolean"`, and optionality resolves through it (verified in a scratch run).
- Wrapper kinds to walk (`def.type`): `object` (shape, catchall), `array` (element), `optional`, `nullable`, `default`,
  `prefault`, `nonoptional`, `readonly`, `catch` (innerType), `union` (options; discriminated union is a union with a
  discriminator), `intersection` (left, right), `record` (valueType), `tuple` (items, rest), `pipe` (the input side:
  `in`, or `out` when `in` is a transform), `lazy` (getter, memoized for recursive schemas).
- The module's dictionary (`src/messages/en.ts`) is the place for text; tool answers today use fixed English
  (`tools.ts`). A `toolInput` group there, overridable per call, keeps both apps and translations in one place.
