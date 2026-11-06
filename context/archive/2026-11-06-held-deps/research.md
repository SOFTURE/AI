# Research: held-deps

- **typescript-eslint 8.72.** Reproduced locally: `eslint .` at `--max-old-space-size=8192` aborts with a heap
  out-of-memory error (peak RSS 8.5 GB); 8.71.2 peaks at 5.95 GB. The diff of `@typescript-eslint/typescript-estree`
  8.71.2 → 8.72.1 adds `useSingleRunProgramForProjectService`: in a single run (inferred from `CI=true` or the ESLint
  bin) the project service now builds one `ts.Program` per tsconfig and keeps them all. This repository has a
  tsconfig per workspace package. With `TSESTREE_SINGLE_RUN=false` 8.72.1 peaks at 5.95 GB and passes with zero
  warnings. `parserOptions.disallowAutomaticSingleRunInference: true` is the config form of the same switch.
  `@softure-ai/config`'s shared ESLint config serves single-app projects (one tsconfig) and is left as it is.
- **forwarded-parse 2.2.0.** `@opentelemetry/instrumentation-http` 0.301.0 pins `forwarded-parse` 2.2.0; the rest of
  the family moved to core/SDK 3.1.0, instrumentation 0.301.0, runtime-node 0.38.0, undici 0.35.0. Bumping the
  family moves the pin. 0.301 also imports it with a static `import { parse } from "forwarded-parse"` (0.300 used a
  rolldown `__require`), so Next.js output tracing follows it and observability's own dependency and `require`
  (the 0.8.0 workaround) are no longer needed.
- **satori 0.63.** Its style normaliser defaults `boxSizing` to `content-box` (CSS's default); 0.35 laid boxes out as
  border boxes. The templates set `width: "100%"` with padding and fixed tile widths with padding, so content grew
  past the frame (portrait-fit oracle: paint in the right and bottom band). Importing 0.63.2 from ESM works (the
  #254 crash was 0.35.2/0.36.0 only).
- **fflate.** GHSA-px8p-9vwx-vf98 (moderate) affects `unzipSync` in 0.7.0–0.7.4. satori 0.63.2 still pins 0.7.3 and
  imports only `inflateSync`; `@shuding/opentype.js` uses the repository's override (0.7.5). npm `overrides` do not
  reach consumers, so the fix for them is their own override, documented.
