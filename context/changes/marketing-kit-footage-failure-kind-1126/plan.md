---
change_id: marketing-kit-footage-failure-kind-1126
status: done
---

# Plan: footage failure kinds (issue #1126)

Input: change.md, research.md. Complexity: small.

## Phase 1: the type

- `footage/failure.ts`: `FootageFailure` (discriminated union on `kind`: `loudness` with `loudness: MixLoudness |
  null`, `publishable` with `problems`, `input`, `process`), `FootageError`, `FootageResult<T>`, `err(message,
  failure = { kind: "process" })`, `isRetryableFootageFailure(failure)` (true for `process` only).
- `pipeline.ts` re-exports `FootageResult` from there; `pipeline.ts`, `draft.ts`, `isolate-ranges.ts` take `err`
  from `failure.ts`.

## Phase 2: the kinds

- Each site in research.md gets its kind; unnamed sites stay `process`.
- `index.ts` exports `FootageFailure`, `FootageError`, `isRetryableFootageFailure`.

## Phase 3: tests and docs

- Tests: a loudness miss (mix stage and finished film) answers `loudness` with the measured values; `mixFootage`
  with its attempts exhausted answers `loudness`; input errors (key terms, EDL, finishVideo, music) answer `input`;
  low disk and a provider failure answer `process`; `err` and `isRetryableFootageFailure` on their own. The
  `publishable` site cannot be reached through the final pass (it always writes a publishable file); it is one line,
  covered by the type and the review.
- CHANGELOG `## Unreleased`, README's footage section.

## Acceptance

- The new tests fail on master (no `failure` field) and pass with the change.
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- `failure` is required on the footage error branch (the app can switch on it without a default); `err` defaults to
  `process`, which matches the issue's "everything else stays a transient kind".
- No `cancelled` kind: an abort rejects today and keeps doing so; changing that contract is out of scope.
- Thrown ffmpeg failures are not turned into results (unchanged contract); documented as transient.

## Progress

- [x] Phase 1: `footage/failure.ts`; `pipeline.ts`, `draft.ts`, `isolate-ranges.ts` take `err`/`ok` from it.
- [x] Phase 2: kinds at every site in research.md; a wrapped footage failure keeps its kind (download, music).
- [x] Phase 3: before the change, 10 footage tests fail on the missing `failure` (vitest run of
  tools/marketing-kit: 10 failed, 1090 passed); after it, `vitest run tools/marketing-kit/src/footage` 475 passed
  (finish.test.ts with ffmpeg included); typecheck, ESLint and the language gate clean. CHANGELOG, README.
