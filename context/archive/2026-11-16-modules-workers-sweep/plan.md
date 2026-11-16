# Plan: modules-workers-sweep (RP-7)

## Approach

Declare every request-path entry of the RP-7 modules Workers-safe and make the guard pass, with the decisions in
`research.md`: the guard allows `node:fs` (virtual in workerd), request-path readers of app files handle Workers
explicitly, modules reach the database through `@softure-ai/db/request`, and everything reaching `@softure-ai/jobs`
waits for RP-4.

## Decisions (auto)

- Declared too, because the module entries import them: `@softure-ai/ui` (`.`, `./next`), `@softure-ai/theme-kit`
  (`.`, `./react`, `./next`), auth `./next` and `./ui`, core `./og`.
- One commit for the sweep instead of one per module: the declarations, the db range and the lockfile move together,
  and a module alone would leave the guard red on the foundation entries it needs.

## Phases

### Phase 1: the guard and core (test-after)
- `tests/repo/workers-entries.ts`: `fs`, `fs/promises` in `WORKERS_BUILTINS` with the measured caveat.
- `foundation/core/src/platform.ts`: `isWorkersRuntime()`; core 0.2.9, CHANGELOG, test.
- Done when: the guard and core tests pass.

### Phase 2: module adapters on `@softure-ai/db/request` and their declarations
- Each RP-7 module: request-path `@softure-ai/db` value imports switch to `/request`; db range `^0.1.15`;
  `softure.workers` lists its request entries (no `./jobs`, `./cli`, `./scripts`, `./stdio`, `./testing`, CSS;
  alerts `./server`, `./next` and blog `./server` wait for RP-4); `runtimes` in the manifest where one exists;
  patch bump and CHANGELOG line.
- Done when: the guard passes for every declared entry and each module's tests pass.

### Phase 3: files refuses the disk on Workers (TDD)
- `createLocalStorage` throws on Workers naming `createS3Storage`; `saveFile({ path })` refuses on Workers.
- Tests stub `navigator.userAgent`.

### Phase 4: pwa's build version on Workers (TDD)
- `getBuildVersion`: `SOFTURE_BUILD_VERSION` first; on Workers without it, a thrown message naming it.

### Phase 5: docs and lockfile
- docs/07 matrix rows per module, roadmap item status via archive, `package-lock.json`.

## Progress

- [x] Phase 1: guard allows `node:fs` with the measured caveat; core `isWorkersRuntime`, core 0.2.9.
- [x] Phase 2: 15 modules plus auth `./next`/`./ui`, ui and theme-kit declared; request-path imports on
  `@softure-ai/db/request`; core `./og` declared (fonts as URLs on Workers). Guard: 82 entry tests green.
- [x] Phase 3: files refuses the local driver and `saveFile({ path })` on Workers (tests seen red, then green).
- [x] Phase 4: pwa `SOFTURE_BUILD_VERSION` (tests seen red, then green).
- [x] Phase 5: docs/07 matrix and fs measurement, CHANGELOGs, `package-lock.json` (versions and ranges only).
