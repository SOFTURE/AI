import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { checkTheme } from "../check-theme.js";
import type { ThemeDefinition } from "../theme-definition.js";
import { parseThemePackageConfig } from "./theme-package-config.js";
import { writeThemeStylesheets } from "./theme-stylesheet.js";

export type BuildResult = { ok: true; files: string[] } | { ok: false; error: string };

const DEFINITION_GROUPS = ["colors", "shadows", "fonts", "textStyles", "radii", "sizes"] as const;

/** A first, structural narrowing of the `theme` export; `checkTheme` then checks the values. */
function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.clearDefaultPalette === "boolean" &&
    DEFINITION_GROUPS.every((group) => typeof record[group] === "object" && record[group] !== null)
  );
}

/**
 * Builds a theme package's stylesheets after `tsc`: reads `softureTheme` from its `package.json` and the `theme`
 * export of the built `dist/tokens.js`, checks the theme, writes `dist/theme.css` and copies the stylesheets.
 */
export async function buildThemePackage(packageDir: string): Promise<BuildResult> {
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as Record<string, unknown>;
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) return parsed;
  const tokensPath = join(packageDir, "dist", "tokens.js");
  let tokens: Record<string, unknown>;
  try {
    tokens = (await import(pathToFileURL(tokensPath).href)) as Record<string, unknown>;
  } catch (error) {
    return { ok: false, error: `cannot load ${tokensPath} (run tsc first): ${error instanceof Error ? error.message : String(error)}` };
  }
  const theme = tokens.theme;
  if (!isThemeDefinition(theme)) return { ok: false, error: `${tokensPath} does not export \`theme\` as a theme definition` };
  const problems = checkTheme(theme);
  if (problems.length > 0) return { ok: false, error: `theme "${theme.name}" breaks the theme contract: ${problems.join("; ")}` };
  return { ok: true, files: writeThemeStylesheets({ packageDir, theme, config: parsed.config }) };
}
