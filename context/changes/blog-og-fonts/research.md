# Research: blog-og-fonts

Depth: quick. Question: what font input does `next/og` accept, and what can the blog reuse from marketing-kit?

## Findings

- **`next/og` replaces its default font when `fonts` is given**: `node_modules/next/dist/compiled/@vercel/og/index.node.js`
  passes `fonts: options.fonts || defaultFonts` to Satori (default: the bundled `Geist-Regular.ttf`). With brand
  fonts the card therefore draws only from them; a character none of them has is not drawn by Geist.
- **Satori's formats**: static `.ttf`, `.otf` and `.woff`; `.woff2` is not parsed (marketing-kit's
  `tools/marketing-kit/src/og/fonts.ts` refuses it for that reason). A file is recognisable by its first four
  bytes: `wOFF`, `OTTO`, `00 01 00 00` or `true`; `wOF2` is WOFF2.
- **Satori picks a font by family name, weight and style**; with a missing weight it draws the nearest one. The
  card uses weight 700 (brand name, title) and 400 (label).
- **Subsets**: Fontsource ships one file per subset (`latin`, `latin-ext`). marketing-kit registers a second
  file of one weight under a separate family name (`Inter #2`) and lists the families in `font-family`, so the
  second file covers the characters the first lacks. For the blog the same works with no extra machinery if
  the card's `font-family` lists every configured name in order: an app names its `latin-ext` file
  `"Inter Ext"`.
- **marketing-kit as a source**: its loader is a CLI tool's (`tools/marketing-kit`, not a dependency of any
  module) and works on `marketing.json` paths with a character-map parse. The blog needs a smaller thing: read
  bytes once per process, check the format by signature. The app can point `brand.fonts` at the same files its
  `marketing.json` uses; no code dependency.
- **Reading a file in an OG route**: Next's own example reads `join(process.cwd(), "assets/…ttf")`; Next runs
  from the app root. With `output: "standalone"` such a file must be listed in `outputFileTracingIncludes`
  (Next traces only imported files). An `https` URL avoids that and is fetched once.
- **Tests**: `@fontsource/inter` (OFL-1.1) is already in the lockfile as marketing-kit's dev dependency; its
  `inter-latin-400-normal.woff` is 30 KB. A probe confirmed `renderArticleOgImage(...).arrayBuffer()` renders a
  PNG under Vitest in about a second, so the card can be rendered in a test.

## Options

1. **The app reads the files and passes buffers in config** (`fonts: [{ data }]`). Rejected: the config loads in
   the CLI too, and the roadmap asks for a path or URL.
2. **A path or URL in `brand.fonts`, read by the OG route once per process and cached** (chosen): the config
   stays plain data and is validated at startup (name, weight, style, source form); the bytes are read lazily on
   the first card and kept in a module-level cache keyed by the resolved source.
3. **Reuse marketing-kit's loader**. Rejected: a tool's internals, a heavier format check than needed, and a new
   dependency edge from a module to a tool.

## Risks

- A wrong path only shows when the first card renders: the error names the option index and the resolved path
  or URL, and a failed read is not cached, so a fixed file is picked up without a restart.
- A URL that answers HTML (a 404 page with status 200) is caught by the signature check.
