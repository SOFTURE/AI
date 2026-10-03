// `@softure-ai/marketing-kit/og`: OG images from templates and data, for the CLI and for a thin Next
// route. Nothing here loads Playwright, so a route can import it.
export { h, listNodes, type OgChild, type OgNode, type OgStyle } from "./element.js";
export { OG_FONT_KINDS, OG_FONT_WEIGHTS, loadOgFonts, pickWeight, type OgFontFamily, type OgFontKind, type OgFontWeight, type OgFonts, type ReadFontFile, type SatoriFont } from "./fonts.js";
export { getOgPalette, toOpaqueHex, withAlpha, type OgPalette } from "./palette.js";
export type { OgResult } from "./result.js";
export {
  DEFAULT_OG_SIZE,
  buildOgTree,
  renderConfiguredOgImage,
  renderOgImage,
  renderOgSvg,
  type ConfiguredOgImageOptions,
  type OgBrand,
  type OgImageInput,
} from "./render.js";
export { OG_TEMPLATE_IDS, OG_TEMPLATES, isOgTemplateId, type OgTemplateId } from "./templates/index.js";
export type { OgTemplateContext } from "./templates/context.js";
export { CHART_TONES, headlineChartDataSchema, headlineCtaDataSchema, type ChartTone, type HeadlineChartData, type HeadlineCtaData } from "./templates/schemas.js";
export { loadMarketingConfig, type LoadConfigResult, type MarketingConfig } from "../config/config.js";
