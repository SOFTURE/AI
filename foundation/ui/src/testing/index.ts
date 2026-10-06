// Test helpers of @softure-ai/ui: WCAG contrast, colour-vision simulation and the both-themes contrast check.
// Plain functions with no test-runner import; failures come back as values for `expect(...).toEqual([])`.
// Never imported by the package's runtime code, so they stay out of app bundles.
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
