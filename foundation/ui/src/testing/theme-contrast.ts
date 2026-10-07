// The both-themes contrast check: every foreground/background pair measured in the light and the dark token set.
// Generalised from an adopting app's theme contrast test (charts roadmap, CH-3): tokens come from theme
// objects instead of a parsed stylesheet, so it checks ui's defaults, an app's override or an app's own tokens.
import { DEFAULT_THEME, type ColorScheme, type SchemeTokenName } from "../theme/tokens.js";
import { blendColors, type ContrastLevel, contrastRatio, type ContrastUse, parseHexColor, WCAG_CONTRAST } from "./color.js";

/** A background painted as `tint` at opacity `alpha` over `over`, e.g. `bg-danger/10` on a surface. */
export interface TintedBackground<K extends string> {
  readonly tint: K;
  readonly alpha: number;
  readonly over: K;
}

export interface ContrastPair<K extends string> {
  readonly foreground: K;
  readonly background: K | TintedBackground<K>;
  readonly use: ContrastUse;
  /** `AA` by default; `AAA` only exists for text and large text. */
  readonly level?: ContrastLevel;
}

/** Token values per colour scheme; a missing token is reported, not skipped. */
export type ThemeSchemes<K extends string> = Readonly<Record<ColorScheme, Readonly<Partial<Record<K, string>>>>>;

interface FailureBase {
  readonly scheme: ColorScheme;
  /** `color-muted on color-surface`, or `color-danger on color-danger/10 over color-surface`. */
  readonly pair: string;
}

/** What went wrong with one pair in one scheme. */
export type ContrastFailureDetail =
  | { readonly kind: "low-contrast"; readonly ratio: number; readonly minimum: number }
  | { readonly kind: "missing-token"; readonly token: string }
  | { readonly kind: "unreadable-color"; readonly token: string; readonly value: string };

export type ContrastFailure = FailureBase & ContrastFailureDetail;

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const GROUNDS = ["color-background", "color-surface", "color-surface-raised"] as const;
const TEXT_TOKENS = ["color-foreground", "color-muted", "color-accent", "color-danger", "color-success", "color-warning"] as const;

/**
 * The pairs `@softure-ai/ui`'s components paint, measured against WCAG 2 AA. `color-border` is decorative and
 * `color-accent-fill` on a light ground is a fill only (1.27:1), so neither is a pair here.
 */
export const DEFAULT_CONTRAST_PAIRS: readonly ContrastPair<SchemeTokenName>[] = [
  ...TEXT_TOKENS.flatMap((foreground) => GROUNDS.map((background) => ({ foreground, background, use: "text" as const }))),
  // Primary button, checked switch and checkbox.
  { foreground: "color-on-accent", background: "color-accent-fill", use: "text" },
  { foreground: "color-on-accent", background: "color-accent-fill-hover", use: "text" },
  // Danger button (text on its tint, then text on the solid hover) and the form error box.
  ...(["color-background", "color-surface"] as const).flatMap((over) => [
    { foreground: "color-danger" as const, background: { tint: "color-danger" as const, alpha: 0.1, over }, use: "text" as const },
    { foreground: "color-foreground" as const, background: { tint: "color-danger" as const, alpha: 0.1, over }, use: "text" as const },
  ]),
  { foreground: "color-background", background: "color-danger", use: "text" },
  // Control outlines and the focus ring (WCAG 1.4.11).
  ...(["color-border-strong", "color-focus"] as const).flatMap((foreground) =>
    GROUNDS.map((background) => ({ foreground, background, use: "non-text" as const })),
  ),
];

function describeBackground<K extends string>(background: K | TintedBackground<K>): string {
  return typeof background === "string"
    ? background
    : `${background.tint}/${Math.round(background.alpha * 100)} over ${background.over}`;
}

type Resolved = { readonly color: string } | { readonly failure: ContrastFailureDetail };

function resolveToken(tokens: Readonly<Partial<Record<string, string>>>, token: string): Resolved {
  const value = tokens[token];
  if (value === undefined) return { failure: { kind: "missing-token", token } };
  if (parseHexColor(value) === null) return { failure: { kind: "unreadable-color", token, value } };
  return { color: value };
}

function measurePair(
  pair: ContrastPair<string>,
  tokens: Readonly<Partial<Record<string, string>>>,
): ContrastFailureDetail | null {
  const { background } = pair;
  const names = typeof background === "string" ? [background] : [background.tint, background.over];
  const foreground = resolveToken(tokens, pair.foreground);
  if ("failure" in foreground) return foreground.failure;
  const grounds: string[] = [];
  for (const name of names) {
    const ground = resolveToken(tokens, name);
    if ("failure" in ground) return ground.failure;
    grounds.push(ground.color);
  }
  const [first = "", second = ""] = grounds;
  const backgroundColor = typeof background === "string" ? first : blendColors(first, second, background.alpha);
  const thresholds: Partial<Record<ContrastLevel, number>> = WCAG_CONTRAST[pair.use];
  const minimum = thresholds[pair.level ?? "AA"] ?? WCAG_CONTRAST[pair.use].AA;
  const ratio = contrastRatio(foreground.color, backgroundColor);
  return ratio < minimum ? { kind: "low-contrast", ratio, minimum } : null;
}

/**
 * Every pair that fails in the light or the dark scheme; empty when all pass. A pair whose token is missing or not a
 * `#rrggbb`/`#rgb` colour (e.g. a `var()` in an override) is reported as such rather than guessed.
 * Without `schemes` it checks ui's `DEFAULT_THEME`; an app passes `mergeThemes(DEFAULT_THEME, itsOverride)`, or its
 * own token names and values.
 */
export function checkThemeContrast(
  pairs: readonly ContrastPair<SchemeTokenName>[],
  schemes?: ThemeSchemes<SchemeTokenName>,
): ContrastFailure[];
export function checkThemeContrast<K extends string>(
  pairs: readonly ContrastPair<K>[],
  schemes: ThemeSchemes<K>,
): ContrastFailure[];
export function checkThemeContrast(
  pairs: readonly ContrastPair<string>[],
  schemes: ThemeSchemes<string> = DEFAULT_THEME,
): ContrastFailure[] {
  return SCHEMES.flatMap((scheme) =>
    pairs.flatMap((pair) => {
      const failure = measurePair(pair, schemes[scheme]);
      if (failure === null) return [];
      const found: ContrastFailure = { scheme, pair: `${pair.foreground} on ${describeBackground(pair.background)}`, ...failure };
      return [found];
    }),
  );
}
