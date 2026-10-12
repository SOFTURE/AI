// The OG card font loader: server only (it reads files), no `next/*` imports. `@softure-ai/seo/server` re-exports it
// for an app's own `opengraph-image` routes, the blog for its article card.
export {
  createOgFontLoader,
  loadOgFonts,
  OG_FONT_WEIGHTS,
  type OgFont,
  type OgFontLoaderOptions,
  type OgFontSource,
  type OgFontsResult,
  type OgFontWeight,
} from "./og-fonts.js";
