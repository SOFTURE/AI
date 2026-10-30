---
change_id: marketing-kit-footage-worker-897
status: archived
---

# Plan: footage blocks in a server worker (issue #897)

Input: change.md, research.md. Complexity: medium-large (one module rewired to async, two new modules, CLI, CI job).

## Phase 1: async process runner

Files: `src/footage/process.ts` (new), `probe.ts`, `normalize.ts`, `render.ts`, tests.

- `runProcess({ command, args, signal, removeOnAbort, onStdoutLine, onStderrLine, cwd, env })`: async `spawn`, an
  abort kills the child (SIGKILL), removes the partial files and rejects with `signal.reason`.
- `runFfmpeg(step, args, { signal, output, onSeconds })` adds `-progress pipe:1 -nostats` and reports
  `out_time_us`; `probeFile`, `probeFootage`, `normalizeFootage` become async with `{ signal, onSeconds }`.

## Phase 2: pipeline options, progress, charges

Files: `pipeline.ts`, `providers.ts`, `elevenlabs.ts`, `paid.ts` (new).

- `FootageRunOptions` gains `signal`, `onProgress({ step, item, itemIndex, itemCount, done, total })` (done/total in
  seconds of media) and `onCharge({ step, item, provider, units, credits?, cacheKey })`.
- Providers' inputs take `signal`; `SttTranscript.credits?`, isolation and music may return `{ audio, credits? }`.
  ElevenLabs reads `character-cost` when present.
- Cache paths in `paid.ts` (`getTranscriptCache`, `getIsolatedCache`, `getMusicCache`) shared by the pipeline,
  `findCachedStep` and `estimateFootageFilm`.

## Phase 3: estimate and cached-step lookup

- `estimateFootageFilm(film, { cacheDir, providers, rates, buildDir? })`: probes (no normalize, no provider call),
  answers `{ items: [{ step, item, provider, units, unit: "seconds", credits, cached }], totalCredits }`.
- `findCachedStep(film, step, item, { cacheDir, providers, buildDir?, edl? })`.

## Phase 4: preflight and CLI

- `checkFootageTools({ needsRender, isBrowserDownloadAllowed })` in `src/footage/tools.ts`; the CLI runs it before
  `footage` (browser download allowed, as the first render downloads it).

## Phase 5: container recipe, CI, docs

- `tools/marketing-kit/docker/footage.Dockerfile`; README recipe; CI job `footage-image` builds it and renders the
  fixture footage film inside it.
- README "Footage films in a worker", CHANGELOG `## Unreleased`.

## Decisions (auto)

- An abort rejects with `signal.reason` (an `AbortError` by default), as `fetch` does; failures stay result values.
- Progress `done` / `total` are seconds of media; `itemIndex` / `itemCount` (1-based) answer "clip 2 of 4".
- `rates` is credits per second for each paid step kind; a cached step costs 0 and still reports its units.
- `item` in the estimate, `findCachedStep` and `onCharge` is the clip id, or `film` for music.
- Video-scored music depends on the cut: without an EDL its cache state is unknown and reported uncached.
- A URL clip not yet downloaded is probed at its URL (free) and its paid steps reported uncached.
- The CLI keeps hyperframes' first-render browser download; a worker image ships the browser and checks for it.
- The CI render of the container recipe is its own job (`footage-image`), so the screen film keeps the runner's Chrome.
- The Dockerfile downloads chrome-headless-shell from Chrome for Testing directly (no `hyperframes browser ensure`,
  which never exits after a download in 0.8.85), and is shipped in the package (`files`).
- hyperframes' per-frame progress lines are logged once per tenth of the render.

## Progress

- [x] Phase 1: async process runner
- [x] Phase 2: pipeline options, progress, charges
- [x] Phase 3: estimate and cached-step lookup
- [x] Phase 4: preflight and CLI
- [x] Phase 5: container recipe, CI, docs
- [x] Implementation review
