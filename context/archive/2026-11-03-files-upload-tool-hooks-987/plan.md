---
change_id: files-upload-tool-hooks-987
status: done
---

# Plan: files MCP upload tools hook and descriptions (issue #987)

Input: change.md, research.md (option 1). Complexity: small (one module file, tests, docs).

## Phase 1: options, tests (TDD)

Files: `modules/files/src/mcp/index.ts`, `modules/files/tests/mcp.test.ts`.

- Export `FILE_UPLOAD_TOOL_DESCRIPTIONS = { create_upload, finalize_upload }` (the current texts).
- `FileUploadToolsOptions` gains:
  - `onFinalized?: (file: StoredFile, ctx: FilesContext) => Promise<FileFinalizedAnswer>` where
    `FileFinalizedAnswer = Readonly<Record<string, unknown>> | Err<ErrorCode> | undefined | void`;
  - `descriptions?: { readonly create_upload?: string; readonly finalize_upload?: string }`;
  - `hints?: Readonly<Record<string, string>>`.
- finalize: after a successful `finalizeUpload`, await the hook; an `err(code)` is returned as the tool's failure;
  a record is merged under the package's fields (`{ ...extra, ...describeStoredFile(file) }`, the file's fields win);
  a throw goes through `answer()`'s generic failure.
- `answer()` takes the hints: failure text = `hints[code] ?? files sentence for files.* codes ?? the code itself`,
  then ` (<code>)`; a non-`files.*` code without a hint answers the code alone.
- Tests: default descriptions served and exported; both descriptions replaced; the hook's fields merged and the file's
  fields kept; the hook runs again on a repeated finalize with the same file; a hook `err` with and without a hint; a
  hint replaces a package code's sentence; a thrown hook error answers the generic text; no options = 0.2.0 answer.

## Phase 2: docs

Files: `modules/files/README.md` (§4.2), `modules/files/CHANGELOG.md` (`## Unreleased`).

- README: the three options with a short example (asset row + job in `onFinalized`, prefixed descriptions).
- CHANGELOG: the entry plus the migration for an app that wraps the server today (drop the wrapper, pass the options;
  `FILE_UPLOAD_MCP_TOOLS` catalog descriptions are unchanged and separate).

## Decisions (auto)

- Package fields win over the hook's on a name clash: `file_id` and friends stay a stable contract.
- The hook runs on every successful finalize, repeats included (the issue asks for it); the README says to keep it
  idempotent. No "first time" flag: `finalizeUpload` does not report one and the issue keeps it out of scope.
- Hints apply to every code the tools answer, not only the hook's: one rule, and an app can reword a package code.
- A map for descriptions (not a callback), with the defaults exported for prefixing.

## Progress

- [x] Phase 1: options, tests (bd70e1d)
- [x] Phase 2: docs (8c235b6)

## Verification

- `vitest run modules/files/tests/mcp.test.ts`: 9 passed; with `src/` stashed the 4 new cases fail (red first).
- `npm run typecheck`, ESLint and the language gate green in the pre-commit hook; `tests/repo` green.
