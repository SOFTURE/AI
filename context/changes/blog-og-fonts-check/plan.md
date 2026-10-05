# Plan: blog-og-fonts-check

Input: change.md. Complexity: small (one phase).

## Goal

- `softure-blog check` reads every `brand.fonts` source through `createOgFontLoader`, paths from the
  working directory (the app's root, as for `findAppDir`), URLs through `fetch`.
- A source it cannot read prints `softure-blog check: <the loader's message>` on stderr, counts as one
  error in the summary line and makes the exit code 1; the files are still checked, so one run shows
  every problem.
- A config without `brand.fonts` prints exactly what it prints today; readable fonts add no line.
- The CLI never imports from `src/next/` (an architecture test says so).

**Out of scope:** drawing a test card with the fonts (the route does it; Satori's own parse is BF-8's
test); `publish` (the card is not rendered there); release or version bumps (releases stay with the owner).

## Approach

**Starting point:** `modules/blog/src/next/og-fonts.ts` holds `createOgFontLoader` (no Next import; only
`import type { OgFont } from "./og-image.js"`) and `loadBrandOgFonts` (a process-wide loader rooted at
`process.cwd()`). `runCheck` in `modules/blog/src/cli/run.ts` gets the blog options, the quality settings,
reads the files and ends in `reportCheck`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the loader lives | `src/server/og-fonts.ts` (with the `OgFont` type); `src/next/og-fonts.ts` keeps `loadBrandOgFonts` and re-exports the rest; `og-image.tsx` re-exports `OgFont` | the CLI already imports `../server/options.js`; nothing under `cli/` reaches `next/`, which an architecture test can pin | change.md constraint |
| Root of a relative path | the command's `cwd` | the bin runs in the app's root, as Next does (`process.cwd()` in `loadBrandOgFonts`); `findAppDir` uses the same `cwd` | plan |
| How the problem is reported | an stderr line `softure-blog check: <message>`, counted as an error in the summary, exit 1; the gate still runs | one run shows a font problem and the text findings; the summary never says "green" on exit 1 | plan |
| URL sources | fetched by `check` (`runBlogCli({ fontFetch })`, default global `fetch`) | the route fetches the same URL; the item asks for "a source it cannot read", URLs included | roadmap item |
| Order | after the quality-off refusal, before reading the files; an empty folder still exits 1 on a font problem | the quality-off refusal already fails the run; a font problem never passes silently | plan |

## Phase 1: `softure-blog check` reads the brand fonts

**Discipline:** TDD. **Files:** `modules/blog/src/server/og-fonts.ts` (new),
`modules/blog/src/next/og-fonts.ts`, `modules/blog/src/next/og-image.tsx`, `modules/blog/src/cli/run.ts`,
`modules/blog/tests/cli.test.ts`, `modules/blog/tests/check-cli.test.ts`,
`modules/blog/tests/architecture.test.ts`, `modules/blog/README.md`.

1. Tests first:
   - `cli.test.ts`, the bin: a config copied into a fresh folder under the fixtures with
     `brand: { name, fonts: [{ name: "Inter", src: "assets/missing.woff" }] }` and no database URL;
     `check` exits 1 with the error `softure-blog check: Blog OG card: brand.fonts[0] "assets/missing.woff":
     the file cannot be read (ENOENT) (<folder>/assets/missing.woff).` and a summary line counting it.
   - `check-cli.test.ts`: a readable font (Inter's `.woff` from `@fontsource/inter`, by absolute path)
     leaves the output of the green run unchanged; an https source the injected `fontFetch` answers 404
     reports `the server answered 404` and exits 1 while the files are still listed; with an empty
     folder the font error still exits 1.
   - `architecture.test.ts`: no file under `src/cli/` imports from `../next/` or `next`.
2. Move `createOgFontLoader`, its types and `OgFont` to `src/server/og-fonts.ts`; `src/next/og-fonts.ts`
   keeps `loadBrandOgFonts` and re-exports; `og-image.tsx` imports `OgFont` from there and re-exports it.
3. `run.ts`: `RunBlogCliOptions.fontFetch`; `runCheck` loads `blogOptions.brand?.fonts` (skipped when
   absent) with `createOgFontLoader({ root: cwd, fetchImpl })`; on failure it prints the line, and
   `reportCheck` takes the extra error count; an empty file list returns 1 when a font failed.
4. README: the check paragraph says it reads `brand.fonts` (and fetches https ones); the font section's
   failure bullet says `check` reports it in CI.

**Tests:** the bin with a missing file; a readable font; a 404 URL; an empty folder; the architecture
rule; the existing check, cli and og-fonts tests unchanged.

**Done when:**
- Automated: the new tests pass and the bin and URL tests failed before step 3; the existing blog tests
  pass unchanged; gates green (typecheck, lint, test, build).

## Risks and rollback

- A CI job without network access and an https font now fails `check` → the README says `check` fetches
  https fonts; a path font needs no network.
- Rollback: revert the phase commit. Nothing persistent changes.

## Decisions (auto)

- Report as a finding of a file or as a separate line? → a separate stderr line counted in the summary:
  the font belongs to the config, not to an article file.
- A flag to skip fonts? → no: the item asks for the check by default, and a path font costs one read.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: `softure-blog check` reads the brand fonts

#### Automated
- [ ] 1.1 The bin's `check` reports a missing font file with the loader's message and exits 1
- [ ] 1.2 A readable font changes nothing; a 404 URL and an empty folder still fail; the CLI never imports `src/next/`
- [ ] 1.3 Gates green (typecheck, lint, test, build)
