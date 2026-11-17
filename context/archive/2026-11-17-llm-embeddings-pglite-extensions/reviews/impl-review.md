# Implementation review: llm-embeddings-pglite-extensions

Verdict: approved, no findings left open.

- Matches the plan: `createEmbedder` with `embedTexts`, `workersAiEmbeddingModel`, `openAiCompatibleEmbeddingModel`,
  `fakeEmbeddingModel`/`embedWords`; `createTestDatabase(modules, { extensions })` with the extensions in the template,
  every copy, the in-process key and the run-wide template name (only when non-empty, so stored names are unchanged).
- Correctness: a timeout aborts `embedMany` and records no usage; an AI SDK error is `llm.unavailable`, any other throw
  is a bug and propagates after failing the span; vectors of another count or length are `llm.invalid_output`.
- Evidence: `npx vitest run foundation/llm` (11 files) and the db testing files (`testing-extensions`, `testing`,
  `testing-template`, `testing-reuse`) pass; the extension test without the option fails with the package's migration
  message. Pre-commit typecheck, ESLint and the language gate green. The adopting app's unit tests run the vault
  migration with `vector`, `pg_trgm` and `unaccent` through this option.
- Versions: llm 0.4.0 (minor: new API, a new `operation` value), db 0.1.17 (patch: new optional option); local tags
  dropped, the lockfile changes only the two version lines.
