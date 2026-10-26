import { defineTheme } from "@softure-ai/theme-kit";

/**
 * The colour roles shadcn/ui components read, as aliases of the design system's own tokens. The design system names
 * its roles itself and two of its names are also shadcn roles with another meaning: `muted` is the secondary text
 * colour and `accent` the accent text and focus colour (shadcn: a muted background and a hover background). The
 * design system's meaning wins, since every component of an app on this theme reads it; a shadcn component that needs
 * the shadcn meaning reads `secondary` (a raised surface) instead.
 */
const SHADCN_ROLES = {
    card: { alias: "surface" },
    "card-foreground": { alias: "foreground" },
    popover: { alias: "surface-raised" },
    "popover-foreground": { alias: "foreground" },
    primary: { alias: "accent-fill" },
    "primary-foreground": { alias: "on-accent" },
    secondary: { alias: "surface-raised" },
    "secondary-foreground": { alias: "foreground" },
    "muted-foreground": { alias: "muted" },
    "accent-foreground": { alias: "foreground" },
    destructive: { alias: "debt" },
    input: { alias: "line-strong" },
    ring: { alias: "accent" },
    "chart-1": { alias: "accessible" },
    "chart-2": { alias: "locked" },
    "chart-3": { alias: "debt" },
    "chart-4": { alias: "position-blue" },
    "chart-5": { alias: "position-violet" },
    sidebar: { alias: "surface" },
    "sidebar-foreground": { alias: "foreground" },
    "sidebar-primary": { alias: "accent-fill" },
    "sidebar-primary-foreground": { alias: "on-accent" },
    "sidebar-accent": { alias: "surface-raised" },
    "sidebar-accent-foreground": { alias: "foreground" },
    "sidebar-border": { alias: "border" },
    "sidebar-ring": { alias: "accent" },
} as const;

/**
 * The Flat Paint theme: the token values of the Flat Paint design system (near-black or white, cards with one hairline,
 * one heavy grotesque, one flat lime accent). `tests/tokens.test.ts` keeps them equal to the design system's token
 * snapshot (`tests/fixtures/flat-paint-tokens.json`); the shadcn roles are aliases on top. A design system value that
 * names another token (`{lime}`) is written out, except for a token that follows another one in both schemes.
 * Text sizes and line heights are the snapshot's px in rem (16 px = 1 rem), so type follows the reader's browser
 * font size; spacing and radii stay px.
 */
export const FLAT_PAINT_THEME = defineTheme({
  name: "Flat Paint",
  colors: {
    "ink": { light: "#0c0c0d", dark: "#0c0c0d" },
    "ink-raised": { light: "#17181a", dark: "#17181a" },
    "ink-line": { light: "#2a2c30", dark: "#2a2c30" },
    "ink-muted": { light: "#a3a6ad", dark: "#a3a6ad" },
    "lime": { light: "#cff26b", dark: "#cff26b" },
    "lime-hover": { light: "#bfe654", dark: "#bfe654" },
    "lime-deep": { light: "#356912", dark: "#356912" },
    "paper": { light: "#ffffff", dark: "#ffffff" },
    "paper-line": { light: "#e6e7ea", dark: "#e6e7ea" },
    "graphite": { light: "#16181d", dark: "#16181d" },
    "graphite-muted": { light: "#5b606b", dark: "#5b606b" },
    "background": { light: "#f6f7f8", dark: "#0c0c0d" },
    "surface": { light: "#ffffff", dark: "#17181a" },
    "surface-raised": { light: "#ffffff", dark: "#1f2023" },
    "border": { light: "#e6e7ea", dark: "#2a2c30" },
    "line-strong": { light: "#8a8f98", dark: "#6b6f77" },
    "foreground": { light: "#16171a", dark: "#f2f3f5" },
    "muted": { light: "#5b606b", dark: "#a3a6ad" },
    "accent": { light: "#356912", dark: "#cff26b" },
    "accent-fill": { light: "#cff26b", dark: "#cff26b" },
    "accent-fill-hover": { light: "#bfe654", dark: "#bfe654" },
    "on-accent": { light: "#0c0c0d", dark: "#0c0c0d" },
    "accessible": { light: "#0f766e", dark: "#2dd4bf" },
    "locked": { light: "#b45309", dark: "#fbbf24" },
    "debt": { light: "#be123c", dark: "#f87171" },
    "position-teal": { light: "#12a18b", dark: "#12a18b" },
    "position-amber": { light: "#bc8415", dark: "#bc8415" },
    "position-blue": { light: "#396bac", dark: "#396bac" },
    "position-violet": { light: "#8c3ae9", dark: "#8c3ae9" },
    "position-lilac": { light: "#c954ff", dark: "#c954ff" },
    "position-steel": { light: "#4b7f9b", dark: "#4b7f9b" },
    "position-magenta": { light: "#ea43e5", dark: "#ea43e5" },
    "position-copper": { light: "#b47c3c", dark: "#b47c3c" },
    ...SHADCN_ROLES,
  },
  shadows: {
    "selected-row": { light: "inset 3px 0 0 #cff26b", dark: "inset 3px 0 0 #cff26b" },
    "shot-frame": { light: "0 0 0 1px #e6e7ea", dark: "0 0 0 1px #e6e7ea" },
  },
  fonts: {
    sans: "Ubuntu, system-ui, sans-serif",
    mono: "\"Ubuntu Mono\", ui-monospace, monospace",
  },
  textStyles: {
    "hero": { fontSize: "5.5rem", lineHeight: "0.92", fontWeight: 700, letterSpacing: "-0.035em" },
    "display": { fontSize: "3.75rem", lineHeight: "1.08", fontWeight: 700, letterSpacing: "-0.02em" },
    "headline": { fontSize: "2.5rem", lineHeight: "1.1", fontWeight: 700, letterSpacing: "-0.02em" },
    "page": { fontSize: "1.875rem", lineHeight: "1.2", fontWeight: 700, letterSpacing: "-0.015em" },
    "section": { fontSize: "1.875rem", lineHeight: "1.15", fontWeight: 700, letterSpacing: "-0.012em" },
    "band": { fontSize: "1.625rem", lineHeight: "1.15", fontWeight: 700, letterSpacing: "-0.022em" },
    "subsection": { fontSize: "1.125rem", lineHeight: "1.35", fontWeight: 700, letterSpacing: "-0.011em" },
    "body": { fontSize: "1rem", lineHeight: "1.5", fontWeight: 400, letterSpacing: "-0.011em" },
    "body-sm": { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 400 },
    "label": { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 500 },
    "caption": { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 400 },
    "eyebrow": { fontSize: "0.6875rem", lineHeight: "1rem", fontWeight: 500, letterSpacing: "0.12em" },
    "figure-lg": { fontSize: "2.25rem", lineHeight: "2.5rem", fontWeight: 700 },
    "figure": { fontSize: "1.5rem", lineHeight: "2rem", fontWeight: 700 },
    "num": { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 500 },
    "tabular": { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 400 },
  },
  radii: {
    "flag": "4px",
    "checkbox": "5px",
    "segment": "6px",
    "control": "8px",
    "nested": "8px",
    "card": "12px",
    "pill": "9999px",
  },
  sizes: {
    "hairbar": "3px",
    "control-x": "12px",
    "button-x": "16px",
    "card-panel": "20px",
    "card": "24px",
    "section": "96px",
    "control-sm": "32px",
    "control-md": "40px",
    "control-lg": "48px",
    "touch": "44px",
    "measure": "42rem",
    "panel": "80rem",
    "apex": "96rem",
  },
  // The design system paints with its roles only, so no raw Tailwind colour utility exists.
  clearDefaultPalette: true,
});

/** The theme under the name every theme package exports, so an app swaps themes by the import path alone. */
export const theme = FLAT_PAINT_THEME;
