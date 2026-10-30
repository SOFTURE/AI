---
change_id: marketing-kit-footage-worker-897
---

# Research: footage blocks in a server worker (issue #897)

## What exists (master a27037f)

- `spawnSync` in `probeFile` (`probe.ts`), `normalizeFootage` (`normalize.ts`), `runFfmpeg` (`render.ts`) and the
  hyperframes render (`runHyperframes` from `render/hyperframes.ts`, used by `renderFootage`). `probeFootage`,
  `prepareFootage`'s loop and `getMusic` call them. Only `tests/render.test.ts` uses `probeFile` outside `src/`.
- Paid steps: `PaidStep { kind, item, provider, seconds }`; the dry run lives in `transcribeFootage` (after
  `prepareFootage` normalized every clip) and in `getMusic`. Cache paths are built inline in `transcribeFootage` and
  `getMusic` from `footageCacheKey` + `hashFile(source)` + trim, so a stand-alone check must share those helpers.
- Providers return `TtsResult<SttTranscript>` and `TtsResult<Buffer>`; nothing carries a cost.
- `findMachineProblem` (`render/preflight.ts`) checks only `ffmpeg -version` and `hyperframes --version`.

## ffmpeg and hyperframes facts

- `ffmpeg -progress pipe:1 -nostats` prints `key=value` blocks; `out_time_us` is the encoded time in microseconds
  (`out_time_ms` is microseconds too, misnamed). Global option, so it can lead the argument list.
- `ffmpeg -hide_banner -decoders` lists `hevc`; `ffmpeg -hide_banner -filters` lists `zscale` (libzimg) and
  `tonemap`. Debian's ffmpeg is built with libzimg, as are the static johnvansickle builds and Homebrew's.
- hyperframes 0.8.85 resolves its browser from `PRODUCER_HEADLESS_SHELL_PATH`, then `HYPERFRAMES_BROWSER_PATH`
  (must exist), then `~/.cache/hyperframes/chrome/chrome-headless-shell/<version>/…` and
  `~/.cache/puppeteer/chrome-headless-shell/<version>/…`. `hyperframes browser path` downloads the browser when
  missing (seen: 261 MB), so a no-network preflight must look at those paths itself.
- hyperframes ships its own `Dockerfile.render` (node:22-bookworm-slim, Debian ffmpeg, Chrome libraries, fonts,
  chrome-headless-shell through `@puppeteer/browsers`): a proven base for the recipe.

## ElevenLabs cost reporting

- TTS responses carry a `character-cost` header; the other endpoints document none. The provider passes the header
  on when present and leaves the charge's `credits` out otherwise.
