# Plan review: blog-og-fonts-check

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 7/7 existing paths (`modules/blog/src/next/og-fonts.ts`, `src/next/og-image.tsx`,
`src/cli/run.ts`, `tests/cli.test.ts`, `tests/check-cli.test.ts`, `tests/architecture.test.ts`,
`README.md`), 6/6 symbols (`createOgFontLoader`, `loadBrandOgFonts`, `OgFont`, `runCheck`, `reportCheck`,
`findAppDir`), the test font `@fontsource/inter/files/inter-latin-400-normal.woff` installed, 4/4 commands
(`workflow.json` gates and `npm run build`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (missing file, readable font, URL, empty folder, no fonts: each has a check) |
| Slicing | PASS |
| Verifiability | PASS (the bin and URL tests fail before step 3) |
| Data and migrations | PASS (no data) |
| Tests | PASS (W1 on the fixture) |
| Security | PASS (only the config's own sources are read; no URL is built from input) |
| Lean | PASS (one moved file, one option, one count) |
| Fit | PASS (`server/` is the CLI's existing non-Next import; the `next` entry keeps its exports) |
| Cost and defaults | PASS (no fonts, no read; a path is one read) |
| Scope | PASS |
| Reuse | PASS (BF-8's loader and messages, BF-6's fixture pattern) |
| Lessons | PASS (Node keeps a module's first evaluation: a fresh folder per config) |
| Progress format | PASS |

## Grounding notes

- `og-fonts.ts` imports `OgFont` from `og-image.tsx` with `import type`, so the compiled file does not load
  `next/og`; moving the type keeps `server/` free of any reference to `next/`, which the architecture test
  can then pin for `cli/` as well.
- `findAppDir(cwd, …)` already treats the command's `cwd` as the app's root, the same root the route uses
  (`process.cwd()` where Next runs).

## Findings

### W1 [WARNING] The bin fixture must stay loadable without a database URL and in a fresh folder

The bin caches a config module by its path; a config with `brand.fonts` written next to an earlier one
would be read once. **Fix:** write the config into its own `mkdtempSync` folder under the fixtures (as
the "without a database URL" block does), with `database.url` from the unset variable so the test also
covers BF-6's path.

### S1 [SUGGESTION] `--config` from another folder

With `--config ../app/softure.config.mjs` the root stays the working directory, not the config's folder.
That matches `findAppDir` and the route; the README sentence names "the working directory".
