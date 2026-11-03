---
change_id: files-upload-tool-hooks-987
title: "files MCP upload tools: a hook after finalize_upload and app-supplied descriptions (issue #987)"
status: archived
roadmap_item: null
issue: [987]
branch: claude/project-thread-232djw
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #987](https://github.com/SOFTURE/AI/issues/987). `registerFileUploadTools` (`@softure-ai/files/mcp`)
serves fixed descriptions and a fixed `finalize_upload` answer, so an adopting app that turns an uploaded file into its
own record in the same call, and that opens every tool description with its own line, wraps the server and replaces
the finalize handler. After this change `FileUploadToolsOptions` takes:

1. `onFinalized(file, ctx)`: runs after every successful finalize (a repeated one too); its returned fields join the
   answer, a returned `err(code)` answers a failure, a thrown error the generic failure;
2. `descriptions: { create_upload?, finalize_upload? }`, with the default texts exported so an app can prefix them;
3. `hints: Record<code, text>`: the text answered for an error code (the hook's codes and the package's own).

## Context

Labels: `enhancement`, `pkg: files`. Files: `modules/files/src/mcp/index.ts`, `modules/files/tests/mcp.test.ts`,
`modules/files/README.md` (§4.2), `modules/files/CHANGELOG.md`. A parallel thread (#988, a browser upload client in
`files`) may also touch `CHANGELOG.md` and `README.md`; conflicts are resolved at merge time.

## Constraints

- No change to the upload route, the wire protocol or `finalizeUpload` (the issue's out of scope).
- Backwards compatible: without the new options the tools answer exactly as in 0.2.0.
- No version bump (the coordinator releases in a batch); the CHANGELOG gets an `Unreleased` entry.
- English only; the adopting app is not changed (its migration is described in the CHANGELOG and README).

## Notes

- Framing: skipped. The issue names the gap and a concrete API; the code confirms it (fixed constants, no hook).
