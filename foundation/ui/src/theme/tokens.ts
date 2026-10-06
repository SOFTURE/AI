// The `--sft-*` token contract (docs/02-module-standard.md §5). Every CSS artefact of the package
// (default tokens, provider overrides, the Tailwind themes) is generated from these lists.

/** Tokens with a value per colour scheme: colours and shadows. */
export const SCHEME_TOKENS = [
  "color-background",
  "color-surface",
  "color-surface-raised",
  "color-foreground",
  "color-muted",
  "color-border",
  "color-border-strong",
  "color-accent",
  "color-accent-fill",
  "color-accent-fill-hover",
  "color-on-accent",
  "color-danger",
  "color-success",
  "color-warning",
  "color-focus",
  "shadow-1",
  "shadow-2",
  "chart-grid",
  "chart-axis",
  "chart-cursor",
  "chart-flag",
  "chart-on-flag",
  "chart-series-1",
  "chart-series-2",
  "chart-series-3",
  "chart-series-4",
  "chart-series-5",
  "chart-series-6",
] as const;

/** Tokens shared by both schemes: typography, shape, spacing and motion. */
export const SHARED_TOKENS = [
  "font-sans",
  "font-mono",
  "font-heading",
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-display",
  "radius-control",
  "radius-card",
  "radius-pill",
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-5",
  "space-6",
  "space-7",
  "space-8",
  "duration-fast",
  "duration-base",
  "duration-slow",
  "ease-out",
  "ease-in-out",
  "chart-line-width",
  "chart-grid-width",
  "chart-dot-size",
  "chart-plot-height",
] as const;

export type SchemeTokenName = (typeof SCHEME_TOKENS)[number];
export type SharedTokenName = (typeof SHARED_TOKENS)[number];
export type TokenName = SchemeTokenName | SharedTokenName;
export type ColorScheme = "light" | "dark";

export type SchemeTokens = Readonly<Record<SchemeTokenName, string>>;
export type SharedTokens = Readonly<Record<SharedTokenName, string>>;

/** A theme or a partial override: per-scheme colours and shadows, plus shared tokens. */
export interface SoftureTheme {
  readonly light?: Partial<SchemeTokens>;
  readonly dark?: Partial<SchemeTokens>;
  readonly shared?: Partial<SharedTokens>;
}

/** A theme with a value for every token. */
export interface CompleteTheme {
  readonly light: SchemeTokens;
  readonly dark: SchemeTokens;
  readonly shared: SharedTokens;
}

/** The CSS custom property of a token: `color-accent` -> `--sft-color-accent`. */
export function tokenVar(name: TokenName): `--sft-${TokenName}` {
  return `--sft-${name}`;
}

// Defaults port the FIRE_TRACKER palette (src/app/globals.css): near-black and grey-white
// surfaces, one flat lime fill. On white the lime is only a fill (1.27:1), so the light accent for
// text and focus is the deep green (4.8:1).
export const DEFAULT_THEME: CompleteTheme = {
  light: {
    "color-background": "#f6f7f8",
    "color-surface": "#ffffff",
    "color-surface-raised": "#ffffff",
    "color-foreground": "#16171a",
    "color-muted": "#5b606b",
    "color-border": "#e6e7ea",
    "color-border-strong": "#8a8f98",
    "color-accent": "#356912",
    "color-accent-fill": "#cff26b",
    "color-accent-fill-hover": "#bfe654",
    "color-on-accent": "#0c0c0d",
    "color-danger": "#be123c",
    "color-success": "#0f766e",
    "color-warning": "#b45309",
    "color-focus": "#356912",
    "shadow-1": "0 1px 2px rgb(12 12 13 / 0.06)",
    "shadow-2": "0 8px 24px rgb(12 12 13 / 0.12)",
    // Charts (@softure-ai/charts): today's role colours, as literals so contrast checks read them.
    // Grid lines are decoration; the axis and the cursor carry meaning (axis >= 4.5:1, cursor >= 3:1).
    "chart-grid": "#e6e7ea",
    "chart-axis": "#5b606b",
    "chart-cursor": "#8a8f98",
    "chart-flag": "#cff26b",
    "chart-on-flag": "#0c0c0d",
    // Series, in the order series take them: brand, ink, purple, pink, blue, teal. Each keeps 3:1 on every ground
    // and every pair stays >= 10 ΔE00 apart in normal vision and protan, deutan and tritan simulation (measured:
    // >= 14.4 here, >= 11.5 in dark); @softure-ai/charts guards it (tests/palette.test.ts, checkSeriesPalette).
    "chart-series-1": "#356912",
    "chart-series-2": "#16171a",
    "chart-series-3": "#a855f7",
    "chart-series-4": "#db2777",
    "chart-series-5": "#1e40af",
    "chart-series-6": "#0d9488",
  },
  dark: {
    "color-background": "#0c0c0d",
    "color-surface": "#17181a",
    "color-surface-raised": "#1f2023",
    "color-foreground": "#f2f3f5",
    "color-muted": "#a3a6ad",
    "color-border": "#2a2c30",
    "color-border-strong": "#6b6f77",
    "color-accent": "#cff26b",
    "color-accent-fill": "#cff26b",
    "color-accent-fill-hover": "#bfe654",
    "color-on-accent": "#0c0c0d",
    "color-danger": "#f87171",
    "color-success": "#2dd4bf",
    "color-warning": "#fbbf24",
    "color-focus": "#cff26b",
    "shadow-1": "0 1px 2px rgb(0 0 0 / 0.4)",
    "shadow-2": "0 8px 24px rgb(0 0 0 / 0.5)",
    "chart-grid": "#2a2c30",
    "chart-axis": "#a3a6ad",
    "chart-cursor": "#6b6f77",
    "chart-flag": "#cff26b",
    "chart-on-flag": "#0c0c0d",
    "chart-series-1": "#cff26b",
    "chart-series-2": "#f2f3f5",
    "chart-series-3": "#c084fc",
    "chart-series-4": "#db2777",
    "chart-series-5": "#2563eb",
    "chart-series-6": "#14b8a6",
  },
  shared: {
    "font-sans": 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    "font-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "font-heading": "var(--sft-font-sans)",
    "text-xs": "0.75rem",
    "text-sm": "0.875rem",
    "text-base": "1rem",
    "text-lg": "1.125rem",
    "text-xl": "1.25rem",
    "text-2xl": "1.5rem",
    "text-3xl": "1.875rem",
    "text-display": "3.75rem",
    "radius-control": "0.5rem",
    "radius-card": "0.75rem",
    "radius-pill": "9999px",
    "space-1": "0.25rem",
    "space-2": "0.5rem",
    "space-3": "0.75rem",
    "space-4": "1rem",
    "space-5": "1.25rem",
    "space-6": "1.5rem",
    "space-7": "1.75rem",
    "space-8": "2rem",
    // All under 300 ms: hover and press, reveal, layout change.
    "duration-fast": "160ms",
    "duration-base": "200ms",
    "duration-slow": "240ms",
    "ease-out": "cubic-bezier(0.22, 0.61, 0.36, 1)",
    "ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
    // Charts: series and grid strokes (they do not scale with the stretched plot), the cursor's dots
    // and the plot's height (its width follows the container).
    "chart-line-width": "2px",
    "chart-grid-width": "1px",
    "chart-dot-size": "0.625rem",
    "chart-plot-height": "16rem",
  },
};
