# Implementation review: deploy-verify-header-lists

Reviewed: the branch diff against plan.md (phase 1) and issue #292.

## Plan conformance

- D1: `checkResponse` expands a list into one `header` outcome per item through the unchanged `checkHeader`; a
  string or `null` takes the same path as before. Matches.
- D2: the schema value is `string.min(1) | array(string.min(1)).min(1) | null`; `[]` and `[""]` are refused with
  the header's path (pinned in `schema.test.ts`). Matches.
- D3: `mergeHeaderChecks` untouched; the README says a route's entry replaces the global one with its whole list.
- D4: README "Headers:" bullet, schema descriptions, regenerated `schema/deploy.schema.json`, CHANGELOG 0.1.6,
  `package.json` and the lockfile at 0.1.6.

## Findings

1. **Suggestion, accepted as is — exported `HeaderChecks` widens.** Library code that reads a config's header
   values now sees `string | string[] | null`. Input files stay valid; only a consumer that narrowed on `string`
   would need a branch. No consumer in the repo does; the CHANGELOG entry describes the new value shape. No change.
2. **Check — tests seen red.** Both new `checks.test.ts` cases failed before the change to `checkResponse`
   (one outcome instead of three, and one instead of two) and pass after it.
3. **Check — gates.** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`: see Progress in plan.md.

## Verdict

Approve; no blocking findings.
