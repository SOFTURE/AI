# Plan: llm embeddings and PGlite extensions

## Approach

Mirror `createLlm`'s call path for embeddings (time limit by race and abort, AI SDK errors mapped to codes, records
after the call, one span) and keep providers out of the dependencies by implementing the two embedding models on the
AI SDK contract directly. In `@softure-ai/db`, thread an `extensions` map through the template build, the copies and
the template keys.

## Phases

### Phase 1: embeddings in @softure-ai/llm (test-first)

- Tests `foundation/llm/tests/embed-texts.test.ts`: order and batching, usage and cost, both records, no texts → no
  call, wrong length → `llm.invalid_output`, provider failure → `llm.unavailable`, hang → `llm.timeout`, option
  validation, the fake's word similarity, the Workers AI adapter (batches, retries a throwing binding, an answer without
  vectors), the OpenAI-compatible adapter (URL, key, dimensions, order by `index`, tokens, 503 retried, 401 not).
- Code: `embeddings.ts`, `embedding-models.ts`, `testing/fake-embedding-model.ts`, exports, README, CHANGELOG.
- Done when: `npx vitest run foundation/llm` passes, typecheck and lint pass.

### Phase 2: PGlite extensions in @softure-ai/db (test-first)

- Tests `foundation/db/tests/testing-extensions.test.ts`: a fixture module whose migration creates `pg_trgm` and a
  trigram index migrates with `{ extensions: { pg_trgm } }`, a second copy can use `similarity()`, and without the
  option the migration fails with the package's message.
- Code: `testing.ts` (option, key, build, copies), `testing/template-store.ts` (name), README, CHANGELOG.
- Done when: the db testing tests pass.

### Phase 3: versions

- `npm run release:version -- llm minor` (0.4.0) and `-- db patch` (0.1.17).

## Progress

- [x] Phase 1: embeddings in @softure-ai/llm
- [x] Phase 2: PGlite extensions in @softure-ai/db
- [x] Phase 3: versions
