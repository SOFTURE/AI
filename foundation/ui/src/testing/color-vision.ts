// Colour-vision simulation and colour distance, so a palette is checked against more eyes than its author's.
// Extracted from an adopting app's palette checks (charts roadmap, CH-3), with tritan vision and CIEDE2000
// added (context/archive/2026-10-06-ui-color-guards/research.md §3-4).
//
// Protan and deutan use the Viénot, Brettel and Mollon (1999) projection the source app measured its palettes
// with, so its numbers stay the same. Tritan uses Machado, Oliveira and Fernandes (2009) at severity 1.0, applied in
// linear sRGB, as Chromium's DevTools emulation does: Viénot's single plane is unreliable for tritanopia.
import { formatHexColor, readHexColor, toLinearChannel, toSrgbChannel } from "./color.js";

export const COLOR_VISIONS = ["protan", "deutan", "tritan"] as const;
/** A dichromacy: no L cones (protan), no M cones (deutan) or no S cones (tritan). */
export type ColorVision = (typeof COLOR_VISIONS)[number];
export type ColorDistanceMetric = "ciede2000" | "cie76";
/** A CIELab colour: lightness 0-100, then the a and b axes. */
export type Lab = readonly [lightness: number, a: number, b: number];

/**
 * Below this CIEDE2000 distance two series colours count as indistinguishable. The source app's minimum between its
 * data roles (CIE76 20) lands at 10-12 in CIEDE2000 on its own pairs (research §3); a palette check may pass its own.
 */
export const DEFAULT_MIN_COLOR_DISTANCE = 10;

type Vector = readonly [number, number, number];

function multiply(matrix: readonly Vector[], [x, y, z]: Vector): Vector {
  const row = (index: number): number => {
    const [a, b, c] = matrix[index] ?? [0, 0, 0];
    return a * x + b * y + c * z;
  };
  return [row(0), row(1), row(2)];
}

function toLinearRgb(color: string): Vector {
  const [red, green, blue] = readHexColor(color);
  return [toLinearChannel(red), toLinearChannel(green), toLinearChannel(blue)];
}

function fromLinearRgb([red, green, blue]: Vector): string {
  return formatHexColor([toSrgbChannel(red), toSrgbChannel(green), toSrgbChannel(blue)]);
}

const RGB_TO_LMS: readonly Vector[] = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
];
const LMS_TO_RGB: readonly Vector[] = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
];
const MACHADO_TRITANOPIA: readonly Vector[] = [
  [1.255528, -0.076749, -0.178779],
  [-0.078411, 0.930809, 0.147602],
  [0.004733, 0.691367, 0.3039],
];

/** How a colour looks to a person with the given dichromacy, as `#rrggbb`. */
export function simulateColorVision(color: string, vision: ColorVision): string {
  const linear = toLinearRgb(color);
  if (vision === "tritan") return fromLinearRgb(multiply(MACHADO_TRITANOPIA, linear));
  const [long, medium, short] = multiply(RGB_TO_LMS, linear);
  // The missing cone signal is replaced by its best estimate from the other two: that is the whole simulation.
  const projected: Vector =
    vision === "protan"
      ? [1.05118294 * medium - 0.05116099 * short, medium, short]
      : [long, 0.9513092 * long + 0.04866992 * short, short];
  return fromLinearRgb(multiply(LMS_TO_RGB, projected));
}

/** CIELab (D65) of an sRGB colour. */
export function toLab(color: string): Lab {
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [red, green, blue] = toLinearRgb(color);
  const x = f((0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047);
  const y = f(0.2126 * red + 0.7152 * green + 0.0722 * blue);
  const z = f((0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const DEGREES = Math.PI / 180;

function getHueAngle(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const angle = Math.atan2(b, a) / DEGREES;
  return angle < 0 ? angle + 360 : angle;
}

/** The CIEDE2000 colour difference (Sharma, Wu and Dalal 2005) of two Lab colours. */
export function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const chromaMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(chromaMean ** 7 / (chromaMean ** 7 + 25 ** 7)));
  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1 = Math.hypot(a1Prime, b1);
  const c2 = Math.hypot(a2Prime, b2);
  const h1 = getHueAngle(b1, a1Prime);
  const h2 = getHueAngle(b2, a2Prime);

  let hueStep = 0;
  if (c1 * c2 !== 0) {
    hueStep = h2 - h1;
    if (hueStep > 180) hueStep -= 360;
    else if (hueStep < -180) hueStep += 360;
  }
  const deltaL = l2 - l1;
  const deltaC = c2 - c1;
  const deltaH = 2 * Math.sqrt(c1 * c2) * Math.sin((hueStep * DEGREES) / 2);

  const lightnessMean = (l1 + l2) / 2;
  const chromaPrimeMean = (c1 + c2) / 2;
  let hueMean = h1 + h2;
  if (c1 * c2 !== 0) {
    hueMean = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hueMean - 30) * DEGREES) +
    0.24 * Math.cos(2 * hueMean * DEGREES) +
    0.32 * Math.cos((3 * hueMean + 6) * DEGREES) -
    0.2 * Math.cos((4 * hueMean - 63) * DEGREES);
  const rotation = 30 * Math.exp(-(((hueMean - 275) / 25) ** 2));
  const chromaWeight = 2 * Math.sqrt(chromaPrimeMean ** 7 / (chromaPrimeMean ** 7 + 25 ** 7));
  const lightnessScale = 1 + (0.015 * (lightnessMean - 50) ** 2) / Math.sqrt(20 + (lightnessMean - 50) ** 2);
  const chromaScale = 1 + 0.045 * chromaPrimeMean;
  const hueScale = 1 + 0.015 * chromaPrimeMean * t;
  const rotationTerm = -Math.sin(2 * rotation * DEGREES) * chromaWeight;

  return Math.sqrt(
    (deltaL / lightnessScale) ** 2 +
      (deltaC / chromaScale) ** 2 +
      (deltaH / hueScale) ** 2 +
      rotationTerm * (deltaC / chromaScale) * (deltaH / hueScale),
  );
}

export interface ColorDistanceOptions {
  /** `ciede2000` (default) is uniform across hues; `cie76` keeps thresholds calibrated on it. */
  readonly metric?: ColorDistanceMetric;
}

/** The perceptual distance of two sRGB colours. */
export function colorDistance(first: string, second: string, options: ColorDistanceOptions = {}): number {
  const a = toLab(first);
  const b = toLab(second);
  return options.metric === "cie76" ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : deltaE2000(a, b);
}

/** The CIELab hue angle, 0-360°: which family of colours a colour reads as. */
export function labHue(color: string): number {
  const [, a, b] = toLab(color);
  return getHueAngle(b, a);
}

/** The shorter way round the hue circle between two colours, 0-180°. */
export function hueDistance(first: string, second: string): number {
  const difference = Math.abs(labHue(first) - labHue(second));
  return Math.min(difference, 360 - difference);
}

export interface VisionDistanceOptions extends ColorDistanceOptions {
  /** The simulations to include next to normal vision; all three by default. */
  readonly visions?: readonly ColorVision[];
}

/** The smallest distance of two colours over normal vision and the simulated ones. */
export function minVisionDistance(first: string, second: string, options: VisionDistanceOptions = {}): number {
  const { visions = COLOR_VISIONS } = options;
  return Math.min(
    colorDistance(first, second, options),
    ...visions.map((vision) =>
      colorDistance(simulateColorVision(first, vision), simulateColorVision(second, vision), options),
    ),
  );
}

export interface ColorCollision {
  readonly first: string;
  readonly second: string;
  readonly vision: ColorVision | "normal";
  readonly distance: number;
}

export interface ColorCollisionOptions extends VisionDistanceOptions {
  /** Pairs closer than this collide; `DEFAULT_MIN_COLOR_DISTANCE` by default. */
  readonly minDistance?: number;
}

/**
 * Every pair of colours that is indistinguishable in normal vision or in one of the simulations. All of them, not
 * the first: fixing a palette one reported pair at a time moves the others.
 */
export function findColorCollisions(
  colors: readonly string[],
  options: ColorCollisionOptions = {},
): ColorCollision[] {
  const { visions = COLOR_VISIONS, minDistance = DEFAULT_MIN_COLOR_DISTANCE } = options;
  const views: readonly (ColorVision | "normal")[] = ["normal", ...visions];
  const collisions: ColorCollision[] = [];
  for (const vision of views) {
    const seen = colors.map((color) => (vision === "normal" ? color : simulateColorVision(color, vision)));
    seen.forEach((firstSeen, i) => {
      for (let j = i + 1; j < seen.length; j += 1) {
        const distance = colorDistance(firstSeen, seen[j] ?? firstSeen, options);
        if (distance < minDistance) {
          collisions.push({ first: colors[i] ?? "", second: colors[j] ?? "", vision, distance });
        }
      }
    });
  }
  return collisions;
}
