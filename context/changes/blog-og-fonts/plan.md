# Plan: blog-og-fonts

Input: change.md, research.md. Complexity: small.

## Goal
`blog({ brand: { fonts: [{ name, weight, style, src }] } })` gives the article OG card (`BlogArticleOgImage`)
the brand's fonts: each `src` (a path from the app root, an absolute path, or an `https` URL) is read on the
first card, checked to be a `.ttf`, `.otf` or `.woff` font, and cached for the life of the process. A file that
cannot be read or is not such a font fails the card with a message naming the option and the file. Without
`brand.fonts` the card keeps `next/og`'s default font.

**Out of scope:** fonts on the blog's HTML pages (they use the app's CSS); a character-map check per file;
loading fonts in `softure-blog check`; the example app's own card (it keeps the default font).

## Approach
**Starting point:** `renderArticleOgImage({ fonts })` exists (`modules/blog/src/next/og-image.tsx`), the
default export never passes fonts, and `brandSchema` (`src/options.ts`) has `name` and `colors` only.

**Chosen:** research option 2. The schema takes the sources; a small loader in `src/next/og-fonts.ts` turns them
into `OgFont`s with an injectable reader (file, fetch, root) and its own cache; the page uses one module-level
loader.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Option shape | `fonts: [{ name, weight = 400, style = "normal", src }]`, at least one, no two with one name, weight and style | the roadmap's fields; Satori picks by those three | roadmap, research |
| Weights | 100 to 900 in steps of 100 | Satori's weights | research |
| `src` forms | `https://` URL, or a path (relative to the app root, `process.cwd()`, or absolute); `http:` and other schemes refused; a `.woff2` ending refused at parse | Satori cannot read WOFF2; no clear-text fetch | research |
| Format check | the first four bytes (`wOFF`, `OTTO`, `00010000`, `true`) | catches an HTML answer, a WOFF2 under another name | research §Risks |
| Cache | per resolved source, the promise of the bytes; a failed read is dropped from the cache | read once; a fixed file is picked up | roadmap, research §Risks |
| Failure | the loader returns `{ ok: false, error }`; `BlogArticleOgImage` throws it as an `Error` | expected failure as a value; a route cannot render without its fonts | AGENTS.md errors |
| Error text | `Blog OG card: brand.fonts[<i>] "<src>": <reason> (<resolved path or URL>).` | names the option and the file | roadmap |
| `font-family` | the card's root lists every configured name once, in order | a second family covers a subset file's missing characters | research §Subsets |
| `OgFont.weight` | widened to the nine Satori weights, `style` adds `"italic"` | matches the option | plan |

## Phase 1: Brand fonts on the article card
**Discipline:** TDD. **Files:** `modules/blog/src/options.ts`, `src/next/og-fonts.ts` (new), `src/next/og-image.tsx`,
`src/next/index.ts`, `modules/blog/package.json` (`@fontsource/inter` dev dependency), `package-lock.json`,
`tests/next/og-fonts.test.ts` (new), `tests/next/og-image.test.tsx`, an options test (the existing options test
file), `modules/blog/README.md`, `context/foundation/roadmap.md`.

1. Tests (red first):
   - options: `brand.fonts` defaults weight 400 and style normal; refuses an `http:` URL, a `.woff2` source, a
     weight of 450, an empty list, and two entries with one name, weight and style.
   - loader: reads a relative path from the root it is given (the fontsource `.woff`), returns `OgFont`s with
     name, weight, style and the bytes; reads one source once across two calls (a counting reader); a missing
     file returns an error naming `brand.fonts[1]`, the source and `ENOENT`, and a second call reads again;
     a URL is fetched once; a non-2xx answer names the URL and the status; bytes that are not a font (HTML,
     a WOFF2 signature) are refused.
   - card: `renderArticleOgImage` with the Inter font gives a PNG (signature) that differs from the default
     font's PNG of the same card; `getOgFontFamily` lists names once, in order.
2. `options.ts`: the font schema inside `brandSchema`; the `.woff2` refusal tests a URL's `pathname` and a path
   as written (plan review S1).
3. `og-fonts.ts`: `createOgFontLoader({ root, readFile, fetchImpl })` → `load(fonts)`; `loadBrandOgFonts` on a
   module-level loader (`process.cwd()`, `node:fs/promises`, global `fetch`).
4. `og-image.tsx`: the wider `OgFont`, the root `fontFamily` when fonts are given, `BlogArticleOgImage` loads
   the brand's fonts and throws a failed load; the header comment says how to configure fonts and that the card
   runs on the Node.js runtime (plan review W1).
5. README: the option in the config example and a short "OG card fonts" note (formats, subsets as a second
   name, `outputFileTracingIncludes` with `output: "standalone"`, the Node.js runtime, plan review W1).

**Tests:** step 1; every existing blog test unchanged.

**Done when:**
- Automated: options, loader and card tests pass (defaults, refusals, read once, missing file named, URL, signature).
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- An app with `output: "standalone"` and a relative path gets the "not found" error in production only: the
  README says to list the folder in `outputFileTracingIncludes`; an `https` URL avoids it.
- Rollback: revert the phase commit; `brand.fonts` disappears and the card uses the default font again.

## Decisions (auto)
- Complexity → small (one phase).
- marketing-kit's loader is not reused (research option 3); the README points at its subset files as a source.
- Plan review W1 (Node.js runtime note) and S1 (`.woff2` on a URL's path) applied.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Brand fonts on the article card

#### Automated
- [ ] 1.1 options, loader and card tests pass (defaults, refusals, read once, missing file named, URL, signature)
- [ ] 1.2 Gates green (typecheck, lint, test, build) and the example app's `next build`
