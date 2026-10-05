# Implementation review: blog-og-fonts-check

Reviewed: the phase 1 commit (c993bc8) against plan.md @ 2026-10-05. Verdict: done.
Findings: 0 critical, 0 warnings, 2 notes. No gaps.

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 1 tests | `tests/cli.test.ts`: the bin's `check` over a config (no database URL) whose `brand.fonts` names `assets/missing.woff` exits 1 with `softure-blog check: Blog OG card: brand.fonts[0] "assets/missing.woff": the file cannot be read (ENOENT) (<folder>/assets/missing.woff).` and a red summary; `tests/check-cli.test.ts`: a readable Inter `.woff` leaves the green run's output unchanged and fetches nothing, a 404 URL is one error in the summary while both files are still listed, an empty folder still exits 1; `tests/architecture.test.ts`: nothing under `src/cli/` imports `../next/` or `next` |
| 2 move | `src/server/og-fonts.ts` holds `createOgFontLoader`, `OgFont`, `OgFontLoaderOptions`, `OgFontsResult`; `src/next/og-fonts.ts` keeps `loadBrandOgFonts` and re-exports the rest; `og-image.tsx` re-exports `OgFont`; `@softure-ai/blog/next` exports the same names |
| 3 check | `runCheck` calls `checkBrandFonts(blogOptions.brand?.fonts, cwd, options.fontFetch)` after the quality-off refusal; the problem is printed on stderr and passed to `reportCheck` as `configErrors`; an empty file list returns 1 when a font failed; `RunBlogCliOptions.fontFetch` |
| 4 README | the check paragraph names the font read (paths from the working directory, https fetched, network needed); the font section says `check` reports a bad file in CI |

## Checks

- The bin test and the URL and empty-folder tests failed before the `run.ts` change (no error line, exit 0)
  and pass after it; the existing check, cli, skill-cli, og-fonts, og-image and og-route tests pass
  unchanged (the config without `brand.fonts` prints the same lines).
- Gates green: typecheck, lint (ESLint and the language gate), `npm test` (3334 passed, 40 skipped), build.
- Diff scanned for non-English text outside message dictionaries: none.

## Notes

- R1 (accepted): the loader stops at the first source it cannot read, by index, as the card does; a
  second bad source shows on the next run. Listing them all would change the loader's contract for the
  route, for a rare case.
- R2 (accepted): `check` creates its own loader per run, so nothing is cached across runs in one process
  (`runBlogCli` from an app script); the route keeps its process-wide cache.
