// `@softure-ai/marketing-kit/og`: OG images from templates and data, for the CLI and for a thin Next
// route. Nothing here loads Playwright, so a route can import it.
export { loadCharacterMap, readCharacterMap, type CharacterMap } from "./character-map.js";
export {
  FONT_USES,
  findMissingCharacters,
  readFontFileInfo,
  type FontFileInfo,
  type FontFileWeight,
  type FontUnusableReason,
  type FontUse,
  type FontUseVerdict,
} from "./font-file.js";
export type { FontFileFormat } from "./font-tables.js";
export { describeCharacter, findMissingGlyphs, selectSatoriFont, type MissingGlyphs } from "./glyphs.js";
export { h, listNodes, type OgChild, type OgNode, type OgStyle } from "./element.js";
export { OG_FONT_KINDS, OG_FONT_WEIGHTS, loadOgFonts, pickWeight, toFontFamilyCss, type OgFontFamily, type OgFontKind, type OgFontWeight, type OgFonts, type ReadFontFile, type SatoriFont } from "./fonts.js";
export { getOgPalette, toOpaqueHex, withAlpha, type OgPalette } from "./palette.js";
export type { OgResult } from "./result.js";
export {
  DEFAULT_OG_SIZE,
  buildOgTree,
  countOgSlides,
  getDefaultOgSize,
  renderConfiguredOgImage,
  renderOgImage,
  renderOgSvg,
  type ConfiguredOgImageOptions,
  type OgBrand,
  type OgImageInput,
} from "./render.js";
export {
  MAX_COVER_CAPTION_LENGTH,
  MAX_COVER_KICKER_LENGTH,
  MAX_COVER_PILL_LENGTH,
  PHOTO_COVER_LAYOUTS,
  PHOTO_COVER_QUALITY,
  PHOTO_COVER_SIZE,
  getCoverBand,
  getCoverCaptionSize,
  isPointUnderCoverText,
  renderPhotoCover,
  type CoverBand,
  type CoverBox,
  type CoverPoint,
  type PhotoCover,
  type PhotoCoverInput,
  type PhotoCoverLayout,
  type PhotoCoverTone,
} from "./photo-cover.js";
export {
  getCoverCrop,
  getOrientationMatrix,
  getOrientedSize,
  readPhotoInfo,
  readTiffOrientation,
  type CoverCrop,
  type FocusPoint,
  type PhotoFormat,
  type PhotoInfo,
  type PhotoOrientation,
} from "./photo.js";
export { OG_TEMPLATE_IDS, OG_TEMPLATES, isOgTemplateId, type OgTemplateId } from "./templates/index.js";
export { PORTRAIT_BASE, getLayoutScale, type OgLayout, type OgTemplateContext } from "./templates/context.js";
export {
  CHART_TONES,
  bigNumberDataSchema,
  carouselDataSchema,
  headlineChartDataSchema,
  headlineCtaDataSchema,
  type BigNumberData,
  type CarouselData,
  type CarouselSlide,
  type ChartTone,
  type HeadlineChartData,
  type HeadlineCtaData,
} from "./templates/schemas.js";
export { loadMarketingConfig, type LoadConfigResult, type MarketingConfig } from "../config/config.js";
