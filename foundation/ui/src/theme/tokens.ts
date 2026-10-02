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
  },
};
