// Server-only logic: the IndexNow submit, the HTML to Markdown conversion and the OG card font loader (core's, for an
// app's own `opengraph-image` routes). No `next/*` imports here (docs/02-module-standard.md §1),
// so a publish CLI can call it outside a request.
export {
  INDEXNOW_ENDPOINT,
  INDEXNOW_MAX_URLS,
  submitToIndexNow,
  type IndexNowFailure,
  type IndexNowRequestBody,
  type IndexNowResult,
  type SubmitToIndexNowOptions,
} from "./indexnow.js";
export { htmlToMarkdown, type HtmlToMarkdownOptions } from "./html-to-markdown.js";
export {
  createOgFontLoader,
  loadOgFonts,
  OG_FONT_WEIGHTS,
  type OgFont,
  type OgFontLoaderOptions,
  type OgFontSource,
  type OgFontsResult,
  type OgFontWeight,
} from "@softure-ai/core/og";
