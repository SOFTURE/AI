// CSS generation from the token contract: theme overrides, the package defaults and the
// Tailwind 4 `@theme` blocks (docs/02-module-standard.md §5).
import {
  type ColorScheme,
  DEFAULT_THEME,
  SCHEME_TOKENS,
  type SchemeTokenName,
  type SchemeTokens,
  SHARED_TOKENS,
  type SharedTokenName,
  type SharedTokens,
  type SoftureTheme,
  tokenVar,
  type TokenName,
} from "./tokens.js";

// A token value lands inside a `<style>` element: anything that could close the declaration, the
// rule or the element, open a comment or escape the next character is refused.
const UNSAFE_VALUE = /[;{}<>\\\r\n]|\/\*/;

/** Whether `value` can be written as a token value without breaking out of its declaration. */
export function isSafeTokenValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !UNSAFE_VALUE.test(value);
}

export interface BuildThemeCssOptions {
  /**
   * Also write the light values on bare `:root`, for browsers without `prefers-color-scheme`.
   * Only safe for CSS that sits below every override (the package defaults in `@layer softure`):
   * unlayered, it would beat the layered dark defaults in dark mode.
   */
  readonly fallback?: boolean;
}

const SCHEME_SELECTORS: Record<ColorScheme, { attribute: string; media: string }> = {
  light: {
    attribute: '[data-theme="light"]',
    media: '@media (prefers-color-scheme: light) {\n:root:not([data-theme="dark"])',
  },
  dark: {
    attribute: '[data-theme="dark"]',
    media: '@media (prefers-color-scheme: dark) {\n:root:not([data-theme="light"])',
  },
};

/**
 * The CSS that applies `theme`: shared tokens on `:root`, each scheme under its `data-theme`
 * attribute and under `prefers-color-scheme` when no attribute overrides it. Tokens the theme does
 * not set are not written, so CSS loaded earlier keeps them. An empty theme gives `""`.
 * Throws a `TypeError` for a token outside the contract or an unsafe value.
 */
export function buildThemeCss(theme: SoftureTheme, options: BuildThemeCssOptions = {}): string {
  const shared = readDeclarations(theme.shared, SHARED_TOKENS, "shared");
  const light = readDeclarations(theme.light, SCHEME_TOKENS, "light");
  const dark = readDeclarations(theme.dark, SCHEME_TOKENS, "dark");

  const rootDeclarations = options.fallback ? [...shared, ...light] : shared;
  const blocks: string[] = [];
  if (rootDeclarations.length > 0) blocks.push(writeRule(":root", rootDeclarations));
  for (const [scheme, declarations] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    if (declarations.length === 0) continue;
    const withScheme = [`color-scheme: ${scheme};`, ...declarations];
    const selectors = SCHEME_SELECTORS[scheme];
    blocks.push(writeRule(selectors.attribute, withScheme));
    blocks.push(`${writeRule(selectors.media, withScheme)}\n}`);
  }
  return blocks.join("\n");
}

/** Several themes into one; later themes win per token. */
export function mergeThemes(...themes: readonly SoftureTheme[]): Required<SoftureTheme> {
  return {
    light: Object.assign({}, ...themes.map((theme) => theme.light)) as Partial<SchemeTokens>,
    dark: Object.assign({}, ...themes.map((theme) => theme.dark)) as Partial<SchemeTokens>,
    shared: Object.assign({}, ...themes.map((theme) => theme.shared)) as Partial<SharedTokens>,
  };
}

/** The page background of each scheme: the colour of the browser bar (`meta theme-color`). */
export function getThemeColors(theme: SoftureTheme = {}): Record<ColorScheme, string> {
  return {
    light: theme.light?.["color-background"] ?? DEFAULT_THEME.light["color-background"],
    dark: theme.dark?.["color-background"] ?? DEFAULT_THEME.dark["color-background"],
  };
}

// Token families and the Tailwind 4 namespace each maps to. Durations have no Tailwind namespace;
// components use `duration-(--sft-duration-fast)`. Chart tokens (`chart-`) are read by
// @softure-ai/charts/styles.css, not by utilities, so they are not mapped either.
const TAILWIND_NAMESPACES: readonly (readonly [tokenPrefix: string, tailwindPrefix: string])[] = [
  ["color-", "--color-"],
  ["font-", "--font-"],
  ["text-", "--text-"],
  ["radius-", "--radius-"],
  ["space-", "--spacing-"],
  ["shadow-", "--shadow-"],
  ["ease-", "--ease-"],
];

export interface BuildTailwindThemeOptions {
  /**
   * The utility prefix of the package build (`sft` gives `sft:bg-surface`). With a prefix the block
   * is a `reference`, so Tailwind emits no variables of its own and every utility reads `--sft-*`.
   * Without one it is the app bridge (`tailwind.css`): plain `bg-surface` in the app's Tailwind.
   */
  readonly prefix?: string;
}

/** A Tailwind 4 `@theme inline` block mapping Tailwind's namespaces onto the tokens. */
export function buildTailwindTheme(options: BuildTailwindThemeOptions = {}): string {
  const header = options.prefix ? `@theme inline reference prefix(${options.prefix}) {` : "@theme inline {";
  const lines = [...SCHEME_TOKENS, ...SHARED_TOKENS].flatMap((name) => {
    const namespace = TAILWIND_NAMESPACES.find(([tokenPrefix]) => name.startsWith(tokenPrefix));
    if (!namespace) return [];
    const [tokenPrefix, tailwindPrefix] = namespace;
    return [`  ${tailwindPrefix}${name.slice(tokenPrefix.length)}: var(${tokenVar(name)});`];
  });
  return [header, ...lines, "}"].join("\n");
}

function readDeclarations<T extends SchemeTokenName | SharedTokenName>(
  tokens: Partial<Readonly<Record<T, string>>> | undefined,
  allowed: readonly T[],
  part: ColorScheme | "shared",
): string[] {
  // An explicit `undefined` (a spread of optional values) means "not set", like a missing key.
  const entries = Object.entries(tokens ?? {}).filter(([, value]) => value !== undefined);
  return entries.map(([name, value]) => {
    if (!(allowed as readonly string[]).includes(name)) {
      throw new TypeError(`Theme token "${name}" is not a ${part} token of the --sft-* contract`);
    }
    if (!isSafeTokenValue(value)) {
      throw new TypeError(`Theme token "${name}" (${part}) has an unsafe or empty value: ${JSON.stringify(value)}`);
    }
    return `${tokenVar(name as TokenName)}: ${value};`;
  });
}

function writeRule(selector: string, declarations: readonly string[]): string {
  return `${selector} {\n${declarations.map((declaration) => `  ${declaration}`).join("\n")}\n}`;
}
