/**
 * How a theme package ships its stylesheet, declared under `softureTheme` in its `package.json`. Data, not a script:
 * every theme builds with the same `softure-theme-css` command, and the repository test reads the same declaration.
 */
export interface ThemePackageConfig {
  /** Folders of components, relative to `theme.css` (`./ui`), that the app's Tailwind scans through `@source`. */
  sources: string[];
  /** CSS packages the components need, imported at the top of `theme.css` (`tw-animate-css`). */
  imports: string[];
  /** Further plain stylesheets in `src/`, copied to `dist/` as they are (`sft-bridge.css`). */
  stylesheets: string[];
}

/**
 * The kit's page stylesheets. Every theme ships them under its own name (`@softure-ai/theme-notion/base.css`) as
 * re-exports of the kit's, so an app imports CSS only from the theme it installed (issue #795).
 */
export const KIT_STYLESHEETS = ["preflight.css", "base.css", "maplibre.css"] as const;

export type ConfigResult = { ok: true; config: ThemePackageConfig } | { ok: false; error: string };

const SOURCE_PATH = /^\.\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;
const STYLESHEET_NAME = /^[a-z0-9-]+\.css$/;
const IMPORT_NAME = /^[@a-z0-9][@a-z0-9._/-]*$/;

function readList(record: Record<string, unknown>, key: keyof ThemePackageConfig, pattern: RegExp, hint: string): string[] | string {
  const value = record[key] ?? [];
  if (!Array.isArray(value)) return `"${key}" is not a list`;
  const items: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== "string" || !pattern.test(item)) return `"${key}" holds ${JSON.stringify(item)}, which is not ${hint}`;
    items.push(item);
  }
  return items;
}

/** Narrows the `softureTheme` value of a `package.json` to a config, or says what is wrong with it. */
export function parseThemePackageConfig(value: unknown): ConfigResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "softureTheme: missing, or not an object" };
  }
  const record = value as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !["sources", "imports", "stylesheets"].includes(key));
  if (unknownKeys.length > 0) return { ok: false, error: `softureTheme: unknown keys ${unknownKeys.join(", ")}` };
  const sources = readList(record, "sources", SOURCE_PATH, "a relative folder like ./ui");
  const imports = readList(record, "imports", IMPORT_NAME, "a package name");
  const stylesheets = readList(record, "stylesheets", STYLESHEET_NAME, "a .css file name in src/");
  for (const result of [sources, imports, stylesheets]) {
    if (typeof result === "string") return { ok: false, error: `softureTheme: ${result}` };
  }
  const taken = (stylesheets as string[]).filter((name) => (KIT_STYLESHEETS as readonly string[]).includes(name));
  if (taken.length > 0) return { ok: false, error: `softureTheme: "stylesheets" holds ${taken.join(", ")}, which the kit's re-exports take` };
  return { ok: true, config: { sources: sources as string[], imports: imports as string[], stylesheets: stylesheets as string[] } };
}
