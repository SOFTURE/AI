---
change_id: llm-embeddings-pglite-extensions
title: "llm: embeddings behind one interface; db: PGlite extensions in test databases"
status: archived
archived_at: 2026-11-17
roadmap_item: null
issue: null
branch: claude/project-thread-1m438k
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Two gaps an adopting app hits when it builds hybrid search on Postgres (full text plus pgvector), fixed generically:

- `@softure-ai/llm` had no embeddings. Add `createEmbedder` with `embedTexts` over AI SDK `embedMany`, the package's
  time limit, error codes, records and spans, plus two models that need no provider package: Workers AI through the
  Worker's binding (Cloudflare host) and any OpenAI-compatible `/embeddings` endpoint (every other host). A fake for
  tests.
- `@softure-ai/db` test databases could not load PGlite extensions (PGlite 0.5 makes `vector`, `pg_trgm`, `unaccent`
  available only when loaded), so a migration with `CREATE EXTENSION` failed in unit tests. Add
  `createTestDatabase(modules, { extensions })`.

## Context

Fixed directly in SOFTURE/AI by the session that met the gap (owner's standing order for adopting apps, 2026-11-16).
Measured: `CREATE EXTENSION vector|pg_trgm|unaccent` on a plain `new PGlite()` fails with "extension is not available";
with `extensions: { vector, pg_trgm, unaccent }` (`@electric-sql/pglite-pgvector` 0.0.17, PGlite 0.5.16 contrib) all
three work, HNSW indexes included. AI SDK 7 `EmbeddingModelV4` is the model contract; `APICallError` (re-exported by
`ai`) carries retryability.

## Scope

- `foundation/llm`: `src/embeddings.ts`, `src/embedding-models.ts`, `src/testing/fake-embedding-model.ts`, contract
  and tracing additions, README, CHANGELOG, minor version (0.4.0).
- `foundation/db`: `extensions` option in `src/testing.ts` and the template name, README, CHANGELOG, patch version
  (0.1.17).

## Notes

- Research skipped: the two gaps and their fix were measured directly (above); no design alternative needed weighing.
- Frame skipped: the need comes from a planned roadmap item of the adopting app, not a doubtful request.
