import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildThemeCss } from "../build-theme-css.js";
import type { ThemeDefinition } from "../theme-definition.js";
import { KIT_STYLESHEETS, type ThemePackageConfig } from "./theme-package-config.js";

const KIT_NAME = "@softure-ai/theme-kit";

export interface ThemeStylesheetInput {
  theme: ThemeDefinition;
  /** `@source` paths: relative to the written file, or absolute (a test compiling the sources in place). */
  sources: readonly string[];
  imports: readonly string[];
}

/**
 * The text of a theme package's `theme.css`: the CSS imports, the component folders as `@source` (Tailwind resolves
 * them relative to the file, so the app's Tailwind finds them inside `node_modules`), then the generated tokens.
 */
export function buildThemeStylesheet({ theme, sources, imports }: ThemeStylesheetInput): string {
  return [
    ...imports.map((name) => `@import ${JSON.stringify(name)};`),
    ...sources.map((source) => `@source ${JSON.stringify(source)};`),
    "",
    buildThemeCss(theme),
  ].join("\n");
}

/**
 * The text of a theme's own copy of a kit stylesheet: an import of the kit's file. It resolves from the theme's
 * `dist/`, so the app gets the kit version the theme depends on and never imports a package it did not declare.
 */
export function buildKitStylesheetReexport(name: (typeof KIT_STYLESHEETS)[number]): string {
  return `/* The kit's ${name}, resolved from this theme's own dependency on ${KIT_NAME}. */\n@import "${KIT_NAME}/${name}";\n`;
}

export interface WriteThemeStylesheetsOptions {
  /** The theme package's folder; its `src/` holds the stylesheets to copy. */
  packageDir: string;
  /** Where the files go; the package's `dist/` by default. */
  distDir?: string;
  theme: ThemeDefinition;
  config: ThemePackageConfig;
}

/** Writes `theme.css`, copies the declared stylesheets and re-exports the kit's; returns the written file names. */
export function writeThemeStylesheets({ packageDir, distDir = join(packageDir, "dist"), theme, config }: WriteThemeStylesheetsOptions): string[] {
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "theme.css"), buildThemeStylesheet({ theme, sources: config.sources, imports: config.imports }));
  for (const name of config.stylesheets) copyFileSync(join(packageDir, "src", name), join(distDir, name));
  for (const name of KIT_STYLESHEETS) writeFileSync(join(distDir, name), buildKitStylesheetReexport(name));
  return ["theme.css", ...config.stylesheets, ...KIT_STYLESHEETS];
}
