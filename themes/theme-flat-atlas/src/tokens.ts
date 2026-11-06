import { defineTheme } from "@softure-ai/theme-kit";

/**
 * The colour roles shadcn/ui components read, as aliases of the design system's own tokens. Two of the design
 * system's role names are also shadcn roles with another meaning: `muted` is the secondary text colour and `accent`
 * the accent text and focus colour. The design system's meaning wins; a shadcn component that needs a raised
 * background reads `secondary`.
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
  destructive: { alias: "accent" },
  input: { alias: "line-strong" },
  ring: { alias: "accent" },
  "chart-1": { alias: "visited" },
  "chart-2": { alias: "place" },
  "chart-3": { alias: "planned" },
  "chart-4": { alias: "muted" },
  "chart-5": { alias: "foreground" },
  sidebar: { alias: "surface" },
  "sidebar-foreground": { alias: "foreground" },
  "sidebar-primary": { alias: "accent-fill" },
  "sidebar-primary-foreground": { alias: "on-accent" },
  "sidebar-accent": { alias: "surface-raised" },
  "sidebar-accent-foreground": { alias: "foreground" },
  "sidebar-border": { alias: "border" },
  "sidebar-ring": { alias: "accent" },
} as const;

/** One tracking for every face and size (designer, 2026-11-06); numbers take 0, the wordmark 0.1em. */
const TRACKING = "0.02em";

/**
 * The Flat Atlas theme: the token values of the Flat Atlas design system (passport paper, flat land, one stamp ink).
 * `tests/tokens.test.ts` keeps them equal to the design system's token snapshot
 * (`tests/fixtures/flat-atlas-tokens.json`); the shadcn roles are aliases on top. Light is the primary scheme: the
 * dark one ("passport cover") is defined, and an app that stays light sets `data-theme="light"` on `<html>`.
 * Text sizes and line heights are the snapshot's px in rem (16 px = 1 rem); spacing and radii stay px. The text styles
 * after `wordmark` are the components' own steps, taken from the design system's component sheet.
 */
export const FLAT_ATLAS_THEME = defineTheme({
  name: "Flat Atlas",
  colors: {
    "stamp": { light: "#BA0E56", dark: "#BA0E56" },
    "stamp-hover": { light: "#A00B49", dark: "#A00B49" },
    "stamp-bright": { light: "#E04A80", dark: "#E04A80" },
    "stamp-soft": { light: "#F2789F", dark: "#F2789F" },
    "passport": { light: "#3255A9", dark: "#3255A9" },
    "passport-soft": { light: "#8DA6E8", dark: "#8DA6E8" },
    "marigold": { light: "#F6921E", dark: "#F6921E" },
    "passport-paper": { light: "#F3F8F3", dark: "#F3F8F3" },
    "paper": { light: "#FFFFFF", dark: "#FFFFFF" },
    "paper-line": { light: "#E1E8E1", dark: "#E1E8E1" },
    "land-paper": { light: "#D8DFD8", dark: "#D8DFD8" },
    "water-paper": { light: "#E6EEF0", dark: "#E6EEF0" },
    "ink": { light: "#241F21", dark: "#241F21" },
    "ink-muted": { light: "#5C5556", dark: "#5C5556" },
    "night": { light: "#141A2E", dark: "#141A2E" },
    "night-raised": { light: "#1B2340", dark: "#1B2340" },
    "night-high": { light: "#232D50", dark: "#232D50" },
    "night-line": { light: "#2F3A60", dark: "#2F3A60" },
    "night-muted": { light: "#A9B1C9", dark: "#A9B1C9" },
    "land-night": { light: "#26304F", dark: "#26304F" },
    "background": { light: "#F3F8F3", dark: "#141A2E" },
    "surface": { light: "#FFFFFF", dark: "#1B2340" },
    "surface-raised": { light: "#FFFFFF", dark: "#232D50" },
    "border": { light: "#E1E8E1", dark: "#2F3A60" },
    "line-strong": { light: "#848D86", dark: "#6E7A90" },
    "foreground": { light: "#241F21", dark: "#F3F8F3" },
    "muted": { light: "#5C5556", dark: "#A9B1C9" },
    "accent": { light: "#BA0E56", dark: "#F2789F" },
    "accent-fill": { light: "#BA0E56", dark: "#BA0E56" },
    "accent-fill-hover": { light: "#A00B49", dark: "#A00B49" },
    "on-accent": { light: "#FFFFFF", dark: "#FFFFFF" },
    "map-ocean": { light: "#E6EEF0", dark: "#141A2E" },
    "map-land": { light: "#D8DFD8", dark: "#26304F" },
    "map-edge": { light: "#F3F8F3", dark: "#141A2E" },
    "visited": { light: "#BA0E56", dark: "#E04A80" },
    "place": { light: "#F6921E", dark: "#F6921E" },
    "planned": { light: "#3255A9", dark: "#8DA6E8" },
    "pin-stroke": { light: "#241F21", dark: "#141A2E" },
    ...SHADCN_ROLES,
  },
  shadows: {},
  fonts: {
    sans: "Raleway, system-ui, sans-serif",
    display: "Calistoga, Georgia, serif",
    mono: "\"DM Mono\", ui-monospace, monospace",
  },
  textStyles: {
    "hero": { fontSize: "8rem", lineHeight: "0.86", fontWeight: 400, letterSpacing: "0" },
    "display": { fontSize: "4.5rem", lineHeight: "0.95", fontWeight: 400, letterSpacing: TRACKING },
    "headline": { fontSize: "2.75rem", lineHeight: "1.05", fontWeight: 400, letterSpacing: TRACKING },
    "section": { fontSize: "1.875rem", lineHeight: "1.15", fontWeight: 400, letterSpacing: TRACKING },
    "subsection": { fontSize: "1.25rem", lineHeight: "1.3", fontWeight: 400, letterSpacing: TRACKING },
    "body": { fontSize: "1.0625rem", lineHeight: "1.55", fontWeight: 400, letterSpacing: TRACKING },
    "body-sm": { fontSize: "0.9375rem", lineHeight: "1.45", fontWeight: 400, letterSpacing: TRACKING },
    "label": { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: 600, letterSpacing: TRACKING },
    "caption": { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 500, letterSpacing: TRACKING },
    "coord": { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 500, letterSpacing: TRACKING },
    "iso": { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 500, letterSpacing: TRACKING },
    "wordmark": { fontSize: "1.0625rem", lineHeight: "1", fontWeight: 600, letterSpacing: "0.1em" },
    "button-sm": { fontSize: "0.8125rem", lineHeight: "1.25rem", fontWeight: 600, letterSpacing: TRACKING },
    "button-lg": { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: 600, letterSpacing: TRACKING },
    "meta": { fontSize: "0.8125rem", lineHeight: "1.4", fontWeight: 400, letterSpacing: TRACKING },
    "unit": { fontSize: "0.9375rem", lineHeight: "1.25rem", fontWeight: 700, letterSpacing: TRACKING },
    "place-name": { fontSize: "1.125rem", lineHeight: "1.2", fontWeight: 400, letterSpacing: TRACKING },
    "tag": { fontSize: "0.75rem", lineHeight: "1.125rem", fontWeight: 700, letterSpacing: TRACKING },
    "tag-detail": { fontSize: "0.6875rem", lineHeight: "1.125rem", fontWeight: 500, letterSpacing: TRACKING },
    "iso-sm": { fontSize: "0.6875rem", lineHeight: "1rem", fontWeight: 500, letterSpacing: TRACKING },
    "postmark": { fontSize: "0.625rem", lineHeight: "1", fontWeight: 500, letterSpacing: TRACKING },
    "postmark-year": { fontSize: "1.125rem", lineHeight: "1", fontWeight: 400, letterSpacing: "0" },
  },
  radii: {
    "tag": "4px",
    "photo": "10px",
    "control": "10px",
    "card": "16px",
    "swatch": "2px",
    "pill": "9999px",
  },
  sizes: {
    "control-sm": "32px",
    "control-md": "40px",
    "control-lg": "52px",
    "header": "64px",
    "pin": "14px",
    "pin-sm": "10px",
    "pin-cluster": "22px",
    "touch": "40px",
    "chip": "34px",
    "chip-code": "24px",
    "unit": "28px",
    "tag": "24px",
    "mark": "44px",
    "postmark": "76px",
    "section": "96px",
    "popover": "260px",
    "counter-bar": "420px",
    "map-min": "720px",
    "site": "90rem",
    "measure": "40rem",
  },
  // The design system paints with its roles only, so no raw Tailwind colour utility exists.
  clearDefaultPalette: true,
});

/** The theme under the name every theme package exports, so an app swaps themes by the import path alone. */
export const theme = FLAT_ATLAS_THEME;
