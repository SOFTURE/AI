# Plan: deploy-verify-header-lists

Input: change.md (research and framing skipped; reasons there). Complexity: small (one phase, one package).

## Goal

A header check accepts `string | string[] | null`; an array passes when the header value contains every item
(case-insensitive) and reports one check per item; `null` means absent. Schema JSON, tests, README, CHANGELOG and
deploy 0.1.6.

**Out of scope:** other match modes (exact, regular expression, "any of"); request headers (`requestHeaders`).

## Findings (the reading behind the plan)

- `headerChecksSchema` (`src/verify/schema.ts`) is `record(name, string.min(1) | null)`, used for `verify.headers`
  and `routes[].headers`; `HeaderChecks` is its output type.
- `checkHeader(name, expected, response)` (`src/verify/checks.ts`): `null` → passes when absent; missing header →
  `missing <name>, expected "<x>"`; else case-insensitive `includes`, detail `<name> has "<x>"` or
  `<name>: "<value>", expected "<x>"`.
- `checkResponse` loops over the merged checks; each outcome becomes one detail line of the route's report row.
- `schema/deploy.schema.json` is generated (`npm run schema -w @softure-ai/deploy`) and a test compares it.
- README § verify ("Headers:" bullet) documents the value as text or `null`.

## Key decisions

- **D1 One outcome per item.** An array expands to one `header` outcome per item, each with today's detail for a
  single substring. A failure names the exact missing item, and a string check stays byte-for-byte the same, so
  reports and existing tests do not change.
- **D2 The array is non-empty, items non-empty.** `[]` would be a check that checks nothing (and reads like
  "absent"); the schema refuses it, as it refuses `""`. Duplicate items are allowed: harmless, and refusing them adds
  code for nothing.
- **D3 A route's entry still replaces the global one as a whole.** No merging of arrays: the existing rule ("a
  route's entry for the same name wins") stays one sentence, and a route can still loosen a global check.
- **D4 Docs.** README "Headers:" bullet with an example (`link` with several `rel` values), the schema description,
  CHANGELOG `0.1.6`, `package.json` 0.1.6, the lockfile and the `deploy-cli-version` default of the reusable deploy workflows.

## Phase 1: header lists (TDD)

- Tests in `src/verify/checks.test.ts`: an array where all items are present passes with one detail per item; one
  item missing fails only that item; a missing header fails every item; case-insensitive match; a string check is
  unchanged (existing tests). In `src/verify/schema.test.ts`: an array parses; `[]` and `[""]` are refused with a
  path naming the header.
- Code: `headerChecksSchema` value `string.min(1) | array(string.min(1)).min(1) | null`; `checkHeader` takes one
  substring; `checkResponse` expands an array.
- Regenerate `schema/deploy.schema.json`; README, CHANGELOG, version bump.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` are green.

## Progress

- [x] Phase 1: header lists — d345117 (typecheck, lint, test, build green)
