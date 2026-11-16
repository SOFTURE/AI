import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig } from "@softure-ai/theme-kit/build";
import { build } from "esbuild";

import { NOTION_THEME } from "../src/tokens.js";
import { GALLERY_DIR } from "./build-gallery.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
/** Where the built bridge page lives; inside the git-ignored gallery folder. */
export const BRIDGE_DIR = join(GALLERY_DIR, "bridge");

const require = createRequire(import.meta.url);

interface UiCssBuilder {
  buildCss: (options: { outDir: string; theme: unknown }) => { gzipBytes: number };
}

function getTailwindCli(): string {
  const manifestPath = require.resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

function fontFace(family: string, weight: number, file: string): string {
  return `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${String(weight)}; src: url("${pathToFileURL(require.resolve(file)).href}") format("woff2"); }`;
}

/** ui's `styles.css`, compiled from its source the way its own build does, so the page needs no prior `npm run build`. */
async function writeUiStyles(): Promise<void> {
  // The workspace folder, like the kit's stylesheets below: ui's build script is not an export of the package.
  const uiDir = join(PACKAGE_DIR, "..", "..", "foundation", "ui");
  const builder = (await import(pathToFileURL(join(uiDir, "scripts", "build-css.mjs")).href)) as UiCssBuilder;
  const theme: unknown = await import("@softure-ai/ui");
  builder.buildCss({ outDir: BRIDGE_DIR, theme });
}

/**
 * The page's stylesheet: the README's wiring for an app that renders `@softure-ai/ui` components beside the theme's
 * (ui's styles first for the layer order, the scoped preflight, the theme, the bridge, the kit's base, the page
 * base), plus the gallery's fonts from npm packages.
 */
function writeStylesheet(): void {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as { softureTheme?: unknown };
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) throw new Error(`softureTheme in package.json: ${parsed.error}`);
  const sources = [...parsed.config.sources.map((source) => join(PACKAGE_DIR, "src", source)), join(PACKAGE_DIR, "visual", "bridge.tsx")];
  writeFileSync(join(BRIDGE_DIR, "theme.css"), buildThemeStylesheet({ theme: NOTION_THEME, sources, imports: parsed.config.imports }));
  const kit = join(PACKAGE_DIR, "..", "theme-kit", "src");
  const fonts = [
    ...[400, 500, 600, 700].map((weight) => fontFace("Gallery Sans", weight, `@fontsource/inter/files/inter-latin-${String(weight)}-normal.woff2`)),
    fontFace("Gallery Mono", 400, "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2"),
  ];
  writeFileSync(
    join(BRIDGE_DIR, "app.css"),
    [
      '@import "./styles.css";',
      "@layer theme, base, components, utilities;",
      '@import "tailwindcss/theme.css" layer(theme);',
      `@import ${JSON.stringify(join(kit, "preflight.css"))};`,
      '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
      '@import "./theme.css";',
      `@import ${JSON.stringify(join(PACKAGE_DIR, "src", "sft-bridge.css"))};`,
      `@import ${JSON.stringify(join(kit, "base.css"))};`,
      `@import ${JSON.stringify(join(PACKAGE_DIR, "src", "page.css"))};`,
      '@theme { --font-sans: "Gallery Sans", sans-serif; --font-mono: "Gallery Mono", monospace; }',
      ...fonts,
      "",
    ].join("\n"),
  );
  execFileSync(process.execPath, [getTailwindCli(), "-i", join(BRIDGE_DIR, "app.css"), "-o", join(BRIDGE_DIR, "bridge.css")], {
    cwd: PACKAGE_DIR,
    stdio: ["ignore", "ignore", "pipe"],
  });
}

/** Builds `visual/.gallery/bridge/index.html`: ui components on the Notion theme, outside and inside a `PageFrame`. */
export async function buildBridgePage(): Promise<string> {
  mkdirSync(BRIDGE_DIR, { recursive: true });
  await writeUiStyles();
  writeStylesheet();
  await build({
    entryPoints: [join(PACKAGE_DIR, "visual", "bridge.tsx")],
    outfile: join(BRIDGE_DIR, "bridge.js"),
    bundle: true,
    // A classic script: Chromium runs it from file://, which refuses module scripts.
    format: "iife",
    jsx: "automatic",
    conditions: ["@softure-ai/source"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  const page = join(BRIDGE_DIR, "index.html");
  writeFileSync(
    page,
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>theme-notion sft bridge</title>\n<link rel="stylesheet" href="bridge.css">\n</head>\n<body>\n<div id="bridge"></div>\n<script src="bridge.js"></script>\n</body>\n</html>\n',
  );
  return page;
}
