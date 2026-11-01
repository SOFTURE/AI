# Research: mcp-access-strict-nullable-919

Reproduced on master with zod 4.6.5: `toStrictToolInput(z.object({ a: z.number().nullable(), b: z.number(), c:
z.boolean().nullable() }))` lists `required: ["b"]`; `safeParse({ b: 1 })` fails. A field `z.number().default(3)`
lists no `default`.

## Findings
- `$ZodTransform` sets `optin = "optional"` so the parser lets it see an absent key. `$ZodPipe.optin` is
  `in.optin`, so every text step reports itself optional.
- The JSON Schema emitter (`inputOptin` in `json-schema-processors.js`) resolves past a pipe whose input is a
  transform, but only at the top of a field. `nullable` copies `innerType.optin`, so `nullable(text step)` reads
  "optional" and the field leaves `required`. The same holds for a union with a scalar option
  (`$ZodUnion.optin` is "optional" when any option is).
- `toJSONSchema` deletes `default` from any node that is transforming in input mode (`isTransforming` walks through
  `default`, `nullable`, `optional`, ...). `default(text step)` therefore loses its default. A text step placed
  outside the default (`preprocess(read, number().default(3))`) keeps it: the pipe lists its output side, which is
  the default node.
- The parser reads `optin` only to decide what an absent key means. A text step passes `undefined` through, so the
  scalar itself rejects a missing value; giving the step the optin of the schema it wraps changes no parse result
  (checked: absent, null, text, number, default, prefault, optional).
- `@modelcontextprotocol/server` 2.3: a tool without `inputSchema` is called as `callback(ctx)` and validation is
  skipped; with one, as `callback(args, ctx)`. Its listing for no schema is `{ type: "object", properties: {} }`.
