# Plan: testing-next-action-guards

Input: change.md, research.md. Complexity: small (one package, additive syntax checks following the existing guards).

## Goal

An app replaces its own server-action guards with `@softure-ai/testing/guards/next`: each rule returns
`file:line: message` for every hit, so `expect(findServerActionProblems(files, options)).toEqual([])` shows all of
them in one run. The issue comment's gaps close in `@softure-ai/testing/guards`.

**Out of scope:** type-checker-based analysis, ESLint rules, a version bump.

## Approach

**Starting point:** `guards` has file reading, line matching and a JSX parser (`visible-text.ts`); nothing knows
directives, exports or call sites.

**Chosen:** one module per rule under `src/guards/next/`, sharing a small `syntax.ts` (parse once, directive,
imported names by module, exported functions, line of a node). Rejected: a single `expectServerActionModules({ root,
actionGlob, implementationGlob })` that reads the disk itself (globs need a dependency and hide the file list a test
already has); regex-only checks (cannot tell a type import or a branch).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Entry | `@softure-ai/testing/guards/next` | the issue's example; keeps Next rules out of the generic entry | change |
| Hit shape | `file:line: message` strings | same as `findLines`, prints readably in `toEqual([])` | research |
| Layer naming | `isImplementation(file)` option, default: file name starts with `do-` or `manage-` | issue rule 3/4 | change |
| Database handle | a parameter (or a destructured / typed option) named `database` or `db` by default; `databaseName` option | issue rule 4 | change |
| Request APIs | named imports from `next/headers` (`cookies`, `headers`, `draftMode`) and `next/server` (`connection`); `requestApis` option adds an app's own wrappers | aliases are followed | plan |
| Success branch | a revalidate call passes inside an `if`/`else`/`switch case`/`?:`/`&&` branch, or after an `if` in the same block that exits (`return`/`throw`/`redirect`/`notFound`); it fails at the top of the function before any such check, and in `catch` or `finally` | a static proxy for "after success is known" | plan |
| Server code (rule 5) | `"use server"` modules, implementation modules and files importing `server-only`; other non-client files only for value names that are not component-shaped | rendering a client component from a server component is normal | plan |
| Module resolution (rule 5) | relative specifiers and `aliases` (e.g. `{ "@/": "" }`) resolved among the given files, `.js` → `.ts`/`.tsx`, `/index` | no file system access | plan |
| Error in URL (rule 6) | a `redirect`/`permanentRedirect` from `next/navigation` whose URL sets `error`, `message`, `reason` or `details` (`params` option) to a literal that is not code-shaped (`[\w.-]+`) or to an expression that reads `.message`/`.stack`, `String(…)`, `JSON.stringify`, `toString()` | codes are fine, free text is not | plan |
| Comment stripping | parser-based, comments become spaces with line breaks kept; `{ syntax: "hash" }` for YAML/shell | strings and URLs are never touched; line numbers stay | comment |

**Critical details:** every rule ignores type-only constructs; a file is parsed as TSX (TS when it ends in `.ts`, so
`<T>x` casts parse).

## Phase 1: Server-action guards

**Discipline:** TDD. **Files:** `foundation/testing/src/guards/next/{index,syntax,async-exports,revalidation,request-apis,database-handle,client-imports,redirect-errors}.ts`,
`foundation/testing/package.json`, `foundation/testing/tests/guards-next.test.ts`

1. Rules, each `(files, options?) => string[]`: `findNonAsyncServerExports`, `findUnguardedRevalidation`,
   `findRequestApisInImplementations`, `findImplementationsWithoutDatabase`, `findClientValueImports`,
   `findErrorDetailsInRedirects`; `findServerActionProblems(files, options)` runs all six, sorted by file and line.
2. `package.json`: `./guards/next` export (source, types, default).

**Tests:** per rule, a passing and a failing fixture; aliases, `export { a as b }`, re-exports from other modules,
type-only imports, `catch`/`finally`, early return, option overrides.

**Done when:**
- Automated: `guards-next.test.ts` passes; Gates green (typecheck, lint, test).

## Phase 2: Comment stripping, string literals, docs

**Discipline:** TDD. **Files:** `foundation/testing/src/guards/{comments,string-literals,index}.ts`,
`foundation/testing/tests/guards.test.ts`, `foundation/testing/README.md`, `foundation/testing/CHANGELOG.md`

1. `stripComments(source, { syntax? })`, `collectStringLiterals(files)` (string and template literals outside module
   specifiers, directives and literal types, shaped as `VisibleText` so `findForbiddenPhrases` takes them).
2. README: `guards/next` section with an example and rule notes, the default-filter note on `readSourceFiles`, new
   rows; CHANGELOG `## Unreleased` lines (#402).

**Tests:** comments in strings, URLs, regex literals and JSX survive; lines are kept; hash syntax; literals from plain
`.ts` with lines; imports and directives left out.

**Done when:**
- Automated: the new tests pass; README and CHANGELOG updated; Gates green (typecheck, lint, test).

## Risks and rollback

- False positives in an app → every rule has an option or a narrow default; revert per phase.

## Decisions (auto)

- One function per rule plus `findServerActionProblems`, instead of a disk-reading `expectServerActionModules`.
- The issue comment's three gaps are in scope: they were raised on this issue and touch the same entry.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Server-action guards

#### Automated
- [ ] 1.1 `guards-next.test.ts` passes
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Comment stripping, string literals, docs

#### Automated
- [ ] 2.1 The new `guards.test.ts` cases pass
- [ ] 2.2 README and CHANGELOG `## Unreleased` updated
- [ ] 2.3 Gates green (typecheck, lint, test)
