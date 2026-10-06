// The series palette guard: every series colour legible on every ground a chart sits on, and every pair of
// series colours apart in normal vision and under protan, deutan and tritan simulation, in both schemes.
// Built on @softure-ai/ui/testing; an app runs it on its merged theme or on its own token names.
import { type ColorScheme, DEFAULT_THEME, type SchemeTokenName } from "@softure-ai/ui";
import {
  checkThemeContrast,
  type ColorVision,
  type ContrastFailure,
  type ContrastPair,
  DEFAULT_MIN_COLOR_DISTANCE,
  findColorCollisions,
  parseHexColor,
  type ThemeSchemes,
  type VisionDistanceOptions,
} from "@softure-ai/ui/testing";
import { SERIES_TOKENS } from "./series-tokens.js";

/** The grounds a chart may sit on: it paints no background of its own. */
export const SERIES_GROUNDS = ["color-background", "color-surface", "color-surface-raised"] as const;

/** Two series colours closer than `minimum` in one scheme and one view. */
export interface SeriesCollision {
  readonly kind: "collision";
  readonly scheme: ColorScheme;
  /** `chart-series-1 and chart-series-3`. */
  readonly pair: string;
  readonly vision: ColorVision | "normal";
  readonly distance: number;
  readonly minimum: number;
}

/** A series colour below 3:1 on a ground, a missing or unreadable token, or a collision. */
export type SeriesPaletteFailure = ContrastFailure | SeriesCollision;

export interface SeriesPaletteOptions<K extends string = string> extends VisionDistanceOptions {
  /** The series tokens, in slot order; `SERIES_TOKENS` by default. */
  readonly tokens?: readonly K[];
  /** The grounds each series must keep 3:1 on; `SERIES_GROUNDS` by default. */
  readonly grounds?: readonly K[];
  /** Pairs closer than this collide; `DEFAULT_MIN_COLOR_DISTANCE` (10 ΔE00) by default. */
  readonly minDistance?: number;
}

function findSchemeCollisions(
  scheme: ColorScheme,
  tokens: readonly string[],
  values: Readonly<Partial<Record<string, string>>>,
  options: SeriesPaletteOptions,
): SeriesCollision[] {
  const { minDistance: minimum = DEFAULT_MIN_COLOR_DISTANCE, metric, visions } = options;
  const distanceOptions: VisionDistanceOptions = { metric, visions };
  // Missing and unreadable tokens are already contrast failures; distances are measured on the rest.
  const readable = tokens.filter((token) => {
    const value = values[token];
    return value !== undefined && parseHexColor(value) !== null;
  });
  // Pair by pair, so a collision names its two tokens even when an app gives two tokens one value.
  return readable.flatMap((first, i) =>
    readable.slice(i + 1).flatMap((second) =>
      findColorCollisions([values[first] ?? "", values[second] ?? ""], { ...distanceOptions, minDistance: minimum }).map(
        (collision): SeriesCollision => ({
          kind: "collision",
          scheme,
          pair: `${first} and ${second}`,
          vision: collision.vision,
          distance: collision.distance,
          minimum,
        }),
      ),
    ),
  );
}

/**
 * Every failure of the series palette in the light and the dark scheme; empty when it passes. Without `schemes` it
 * checks ui's `DEFAULT_THEME`; an app passes `mergeThemes(DEFAULT_THEME, itsOverride)`, or its own token names in
 * `options.tokens` and `options.grounds`. Contrast failures come first, then collisions
 * pair by pair (light, then dark).
 */
export function checkSeriesPalette(
  schemes?: ThemeSchemes<SchemeTokenName>,
  options?: SeriesPaletteOptions<SchemeTokenName>,
): SeriesPaletteFailure[];
export function checkSeriesPalette<K extends string>(
  schemes: ThemeSchemes<K>,
  options: SeriesPaletteOptions<K>,
): SeriesPaletteFailure[];
export function checkSeriesPalette(
  schemes: ThemeSchemes<string> = DEFAULT_THEME,
  options: SeriesPaletteOptions = {},
): SeriesPaletteFailure[] {
  const { tokens = SERIES_TOKENS, grounds = SERIES_GROUNDS } = options;
  const pairs: ContrastPair<string>[] = tokens.flatMap((foreground) =>
    grounds.map((background) => ({ foreground, background, use: "non-text" as const })),
  );
  const collisions = (["light", "dark"] as const).flatMap((scheme) =>
    findSchemeCollisions(scheme, tokens, schemes[scheme], options),
  );
  return [...checkThemeContrast(pairs, schemes), ...collisions];
}
