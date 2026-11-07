---
change_id: marketing-kit-audit-reachability-1191
---

# Research: where the kit could reach the pinned undici and fflate

- Reproduced on a clean install of `@softure-ai/marketing-kit@0.21.0`: `npm audit --omit=dev` reports 1 high
  (`undici` 7.25.0) and 4 moderate (`fflate` 0.7.3, and `hyperframes`, `satori`, the kit through them). No fix
  available: `hyperframes` pins `undici` exactly (0.9.6 to 0.9.19), `satori` pins `fflate` exactly (0.63.2 is the
  latest).
- hyperframes 0.9.6 imports `undici` in one place (`dist/chunk-QDB7EFLI.js`, `fetchPublic`): an `Agent` with a
  public-only DNS lookup, used by `downloadToTemp` and `fetchPublicHttpsText`. Their callers in the render and
  preview compiler (`chunk-KXAGCBVO.js`) are the remote `<video|audio|source|img src="http(s)://…">` tags and
  remote stylesheets and `@font-face url(http(s)://…)`. A composition with no remote reference never loads undici.
- The kit's compositions (`compose/compose.ts`, `footage/compose.ts`) take every `src` from the build folder:
  fonts are copied to `assets/fonts/<n>.<ext>` (`render/render.ts` `copyFonts`), sounds, logo, frames and clips are
  copied or normalized locally; URL clips are downloaded by the kit itself with the global `fetch`
  (`footage/pipeline.ts` `download`). Nothing in the kit imports `undici`.
- The kit's preflight runs `hyperframes --version`; Chrome downloads go through `@puppeteer/browsers`, not undici.
- satori and `@shuding/opentype.js` only call `inflateSync` from fflate; GHSA-px8p-9vwx-vf98 is in `unzipSync`.
