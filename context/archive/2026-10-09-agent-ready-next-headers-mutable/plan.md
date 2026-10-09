---
change_id: agent-ready-next-headers-mutable
status: archived
---

# Plan: nextHeaders() is assignable to NextConfig.headers (issue #304)

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Today (master `e13ae0c`)

- `modules/agent-ready/src/link-header.ts`: `NextHeaderRule` is
  `{ readonly source: string; readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }> }`;
  `nextHeaders()` returns `NextHeaderRule[]`.
- Next 16 (`next/dist/lib/load-custom-routes.d.ts`): `Header = { source: string; basePath?: false; locale?: false;
  headers: { key: string; value: string }[]; has?; missing? }`, and `NextConfig.headers` is
  `() => Promise<Header[]> | Header[]`. A readonly array is not assignable to a mutable one, so the README example
  fails with TS2322.
- The only test (`tests/documents.test.ts`) compares values, so the type gap went unnoticed.

## Decisions (auto)

1. **Mutable structural type**, the issue's first suggestion: `headers: Array<{ key: string; value: string }>`.
   `readonly` on the object properties does not block assignability, but the fields are dropped too, to match
   Next's `Header` exactly. Each call builds fresh arrays, so a caller that mutates them harms nothing.
2. **The type test lives in the package's tests**, which import `next` types only (root devDependency); the source
   still imports nothing.

## Phase 1: mutable rule type (TDD)

Files: `modules/agent-ready/src/link-header.ts`, `modules/agent-ready/tests/documents.test.ts`.

1. Test first, red on master (typecheck TS2322): a `NextConfig` whose `async headers()` returns
   `[...nextHeaders({ markdown: true })]` (the README example verbatim) resolves to the same rules.
2. Make `NextHeaderRule` mutable; update its JSDoc.

Done when: `npm run typecheck` fails on master with the test and passes after; gates green.

## Phase 2: docs and version

Files: `modules/agent-ready/README.md` (type the example as `NextConfig`), `CHANGELOG.md` (`## 0.1.2`), version 0.1.2
in `package.json`, `module.json`, `src/index.ts` and `package-lock.json`.

## Progress

- [x] Phase 1: mutable rule type (typecheck red on master with the new test, green after)
- [x] Phase 2: docs, version 0.1.2
