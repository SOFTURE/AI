---
change_id: files-resumable-uploads-949
verdict: approved
---

# Implementation review

Reviewed the diff of ca418e5, e75b823, fb973d4 and 32f9c27 against change.md, plan.md and the issue.

- Acceptance, per proposal of the issue: sessions table (1), `createUpload` with every limit up front and the key
  check (2), the route with chunk-aligned `PUT`, the single-request case, `HEAD`, streaming with a cap and the
  `files-upload` rate limit (3), idempotent `finalizeUpload` with size and SHA-256 checks and dedupe and quota through
  `saveFile` (4), `@softure-ai/files/mcp` with the `curl` loop and the page as fallback (5), the browser page (6), prune
  (7), the bypass docs (8). Each has a test in `tests/uploads.test.ts`, `tests/upload-route.test.ts` or
  `tests/mcp.test.ts`; the `curl` loop is run offline by bash with a stand-in for the request.
- Safety: the token is verified (constant-time, every key) before the rate limit and any query; one `404` for every
  dead URL; a recorded chunk is never rewritten, so a finalize reads immutable parts; a checksum or size mismatch is
  raised inside the save's stream, so the save drops its own object and never touches a deduplicated older file; a
  racing finalize keeps one file and never deletes the winner's (also when dedupe answered the same file). The page
  escapes all copy and the name, embeds its config as script-safe JSON and runs under a nonce CSP with
  `connect-src 'self'`.
- Compatibility: additive migration and options; `PruneFilesReport` and `FilesUserData` gain fields (the existing tests
  were updated for them); new dependency `@softure-ai/security` and optional peer `@modelcontextprotocol/server`.
  mcp-access is unchanged; its strict input and write switch apply through the app's factory and `identity.canWrite`.
- Gates: typecheck, ESLint and the language gate (pre-commit) green on every commit; `vitest run tests/repo
  modules/files` 935 passed; `npm run build` green.
- Noted, accepted: a finalize copies the bytes once more in storage (recorded in plan.md); without the security module
  the route has no rate limit (documented).

Verdict: approved.
