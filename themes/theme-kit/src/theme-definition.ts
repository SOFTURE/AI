/** A colour or shadow with one value per colour scheme. */
export interface SchemeValue {
  light: string;
  dark: string;
}

/** A colour that follows another token of the same theme in both schemes (`chart-1` → `blue`). */
export interface ColorAlias {
  alias: string;
}

export type ColorValue = SchemeValue | ColorAlias;

/** A named text style: `text-<name>` sets the size, line height, weight and tracking at once. */
export interface TextStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

/**
 * Everything a theme decides, as plain data. `buildThemeCss` turns it into the theme's CSS; a theme package keeps
 * one definition and ships the generated file.
 */
export interface ThemeDefinition {
  /** The theme's name, written into the generated file's header. */
  name: string;
  /** Colour tokens by name (`background`, `primary`, `green-tag`), utilities `bg-<name>`, `text-<name>`. */
  colors: Record<string, ColorValue>;
  /** Shadows by name without the prefix (`menu` → `--shadow-menu`, `shadow-menu`). */
  shadows: Record<string, SchemeValue>;
  /** Font stacks by family (`sans` → `font-sans`). */
  fonts: Record<string, string>;
  /** Named text styles (`page-title` → `text-page-title`). */
  textStyles: Record<string, TextStyle>;
  /** Radii by step (`md` → `rounded-md`). */
  radii: Record<string, string>;
  /** Layout sizes as spacing values (`sidebar-width` → `w-sidebar-width`). */
  sizes: Record<string, string>;
  /** Clears Tailwind's default palette, so only the theme's colours exist as utilities. */
  clearDefaultPalette: boolean;
}

/**
 * The colour roles shadcn/ui components read. Every theme defines them, so a component written for one theme renders
 * in another; a theme adds its own tokens on top.
 */
export const SHADCN_COLOR_ROLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export type ShadcnColorRole = (typeof SHADCN_COLOR_ROLES)[number];

/** The shadcn colour roles a definition lacks, in contract order; empty when it is complete. */
export function findMissingColorRoles(definition: Pick<ThemeDefinition, "colors">): ShadcnColorRole[] {
  return SHADCN_COLOR_ROLES.filter((role) => !(role in definition.colors));
}

export function isColorAlias(value: ColorValue): value is ColorAlias {
  return "alias" in value;
}
