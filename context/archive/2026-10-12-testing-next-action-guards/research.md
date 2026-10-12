# Research: testing-next-action-guards

Input: change.md (issue #402 and its comment). Depth: quick (one package, additive guard functions over source text).
Snapshot: 1d458fe on claude/project-thread-dqzwyl (master 1d458fe), 2026-10-12 19:20 Europe/Warsaw.

## Summary

`@softure-ai/testing/guards` reads files (`readSourceFiles`, `foundation/testing/src/guards/source-files.ts:30`),
matches lines (`findLines`, `lines.ts:7`), lists import specifiers with a regex (`readImports`, `lines.ts:23`) and
parses JSX with the TypeScript compiler API (`visible-text.ts:84`). The six rules need syntax, not lines: directives,
exported declarations, call sites and their enclosing branches, import clauses with `type` modifiers. The compiler API
is already a dependency of the entry (`typescript` optional peer), so the new rules parse each file once with
`ts.createSourceFile` and walk it. A new subpath `./guards/next` keeps Next-specific rules out of the generic entry;
the repository's shape test accepts any code export ordered source → types → default
(`tests/repo/packages.test.ts:115`).

## Current state

- Server actions in this repo: `examples/next-app/app/actions.ts` (validates, writes, `if (!result.ok) return
  result; revalidatePath("/")`), module actions under `modules/*/src/next/actions.ts`; `mcp-access/src/next/issue-token.ts`
  is an implementation called from an app's `"use server"` file.
- Request APIs come from `next/headers` (`cookies`, `headers`, `draftMode`) and `next/server` (`connection`).
- `redirect` / `permanentRedirect` come from `next/navigation`.
- No guard in the repo covers these rules; the adopting app's ~350 lines are not in this repository.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Next guards | `foundation/testing/src/guards/next/*.ts` (new) | the six rules and `findServerActionProblems` |
| Generic guards | `foundation/testing/src/guards/comments.ts`, `string-literals.ts` (new), `index.ts` | `stripComments`, `collectStringLiterals` |
| Manifest | `foundation/testing/package.json` | `./guards/next` export |
| Tests | `foundation/testing/tests/guards-next.test.ts` (new), `guards.test.ts` | proofs |
| Docs | `foundation/testing/README.md`, `CHANGELOG.md` | API tables, default-filter note, Unreleased |

## Data

None.

## Tests

`npm test` runs `foundation/testing/tests/*.test.ts`; `guards.test.ts` builds `SourceFile` values inline, the same
works for the new rules without touching disk.

## Patterns to follow

- A guard takes `readonly SourceFile[]` and returns hits; line guards return `file:line: text` strings
  (`lines.ts:7-12`). The new rules return `file:line: message` strings, so a failing `toEqual([])` prints them all.
- Options objects, JSDoc on every export, README API table per entry.

## Prior work

- `context/archive/*testing*` (#326) created the `guards` entry with `readSourceFiles` / `findLines` / visible text.

## SOFTURE modules

Not covered elsewhere: no package checks server-action structure.

## Risks

- Static analysis without type information: rules 2 and 6 are heuristics. Mitigation: conservative definitions,
  documented in the README, with options for app naming.
