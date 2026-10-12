// Test helpers of @softure-ai/ui: WCAG contrast, colour-vision simulation and the both-themes contrast check,
// and source guards for an app's design system (token classes, native tooltips, hover-only handlers,
// restricted elements). Plain functions with no test-runner import; failures come back as values for
// `expect(...).toEqual([])`. The source guards read code with the TypeScript parser, so `typescript` must
// be installed (an optional peer dependency). Never imported by the package's runtime code.
export {
  blendColors,
  type ContrastLevel,
  contrastRatio,
  type ContrastUse,
  formatHexColor,
  getContrastLevel,
  parseHexColor,
  relativeLuminance,
  type Rgb,
  WCAG_CONTRAST,
} from "./color.js";
export {
  type ColorCollision,
  type ColorCollisionOptions,
  colorDistance,
  type ColorDistanceMetric,
  type ColorDistanceOptions,
  type ColorVision,
  COLOR_VISIONS,
  DEFAULT_MIN_COLOR_DISTANCE,
  deltaE2000,
  findColorCollisions,
  hueDistance,
  type Lab,
  labHue,
  minVisionDistance,
  simulateColorVision,
  toLab,
  type VisionDistanceOptions,
} from "./color-vision.js";
export {
  checkThemeContrast,
  type ContrastFailure,
  type ContrastFailureDetail,
  type ContrastPair,
  DEFAULT_CONTRAST_PAIRS,
  type ThemeSchemes,
  type TintedBackground,
} from "./theme-contrast.js";
export { type AllowedFile, type GuardSource } from "./guard-source.js";
export { findUndefinedTokenClasses, type TokenClassOptions } from "./token-classes.js";
export { findHoverOnlyHandlers, findNativeTooltips, findRestrictedElements, type RestrictedElementOptions } from "./jsx-guards.js";
