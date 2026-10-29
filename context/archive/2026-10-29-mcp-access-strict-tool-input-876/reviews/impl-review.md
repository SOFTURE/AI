---
change_id: mcp-access-strict-tool-input-876
verdict: approved
---

# Implementation review

Reviewed 18b7206 against plan.md and issue #876.

- `withStrictToolInput` replaces the instance's `registerTool` once (a `WeakSet` makes a second wrap a no-op) and
  rewrites `inputSchema` before the SDK stores it, so validation, the handler's parsed input and `tools/list` all see
  the strict schema. Tests drive the SDK's own `tools/call` through `createMcpHandler` and assert the handler spy is
  never called on a refusal.
- The rewrite covers object, array, optional, nullable, default, prefault, nonoptional, readonly, catch, union
  (plain and discriminated), intersection, record, tuple, pipe (input side) and lazy (memoized, so recursion ends);
  each has a test except prefault, nonoptional, readonly and catch, which share the `innerType` branch with tested
  kinds. Objects with their own catchall stay open (test).
- Messages come from `mcpAccessMessages.en.toolInput` and can be replaced per call (test). Renamed fields only fire
  where the object accepts the new name; otherwise the old name is an unknown field (test).
- Text scalars: exact `"true"`/`"false"` and JSON number literals only; whitespace, hex, empty text and other casing
  are refused; the field's own checks run after the conversion (`"-1"` fails `min(0)`). The listing keeps
  `boolean`/`integer`/`number` and adds `additionalProperties: false` (exact JSON asserted).
- Clones keep refinements, the object's own error map for other issues and registry metadata (descriptions), with
  the `id` dropped so no id is registered twice.
- The factory applies the option to the served and the recording server; the served version equals the strict
  measurement and differs from the loose one (test).
- Gates: typecheck, ESLint (zero warnings), language gate, `vitest modules/mcp-access` (23 files, 350 tests) green.
  README (§1, §4 "Strict tool input", §9) and the changelog describe the API.

Verdict: approved.
