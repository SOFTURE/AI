import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig } from "@softure-ai/theme-kit/build";
import { build } from "esbuild";

import { NOTION_THEME } from "../src/tokens.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
/** Where the built gallery page lives; git-ignored. */
export const GALLERY_DIR = join(PACKAGE_DIR, "visual", ".gallery");

const require = createRequire(import.meta.url);

function getTailwindCli(): string {
  const manifestPath = require.resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

function fontFace(family: string, weight: number, file: string): string {
  return `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${String(weight)}; src: url("${pathToFileURL(require.resolve(file)).href}") format("woff2"); }`;
}

/**
 * The gallery's stylesheet: an app's globals.css (Tailwind, the theme, the kit's base) plus fonts shipped in npm
 * packages instead of the system stack, so the container and the CI runner rasterise the same glyphs.
 */
function writeStylesheet(): void {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as { softureTheme?: unknown };
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) throw new Error(`softureTheme in package.json: ${parsed.error}`);
  const sources = [...parsed.config.sources.map((source) => join(PACKAGE_DIR, "src", source)), join(PACKAGE_DIR, "tests", "gallery")];
  writeFileSync(join(GALLERY_DIR, "theme.css"), buildThemeStylesheet({ theme: NOTION_THEME, sources, imports: parsed.config.imports }));
  const fonts = [
    ...[400, 500, 600, 700].map((weight) => fontFace("Gallery Sans", weight, `@fontsource/inter/files/inter-latin-${String(weight)}-normal.woff2`)),
    fontFace("Gallery Mono", 400, "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2"),
  ];
  const base = join(PACKAGE_DIR, "..", "theme-kit", "src", "base.css");
  writeFileSync(
    join(GALLERY_DIR, "app.css"),
    [
      '@import "tailwindcss" source(none);',
      '@import "./theme.css";',
      `@import ${JSON.stringify(base)};`,
      '@theme { --font-sans: "Gallery Sans", sans-serif; --font-mono: "Gallery Mono", monospace; }',
      ...fonts,
      "",
    ].join("\n"),
  );
  execFileSync(process.execPath, [getTailwindCli(), "-i", join(GALLERY_DIR, "app.css"), "-o", join(GALLERY_DIR, "gallery.css")], {
    cwd: PACKAGE_DIR,
    stdio: ["ignore", "ignore", "pipe"],
  });
}

/** Builds `visual/.gallery/index.html`: every gallery case, bundled for the browser, on the compiled theme. */
export async function buildGallery(): Promise<string> {
  mkdirSync(GALLERY_DIR, { recursive: true });
  writeStylesheet();
  await build({
    entryPoints: [join(PACKAGE_DIR, "visual", "gallery.tsx")],
    outfile: join(GALLERY_DIR, "gallery.js"),
    bundle: true,
    // A classic script: Chromium runs it from file://, which refuses module scripts.
    format: "iife",
    jsx: "automatic",
    conditions: ["@softure-ai/source"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  const page = join(GALLERY_DIR, "index.html");
  writeFileSync(
    page,
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>theme-notion gallery</title>\n<link rel="stylesheet" href="gallery.css">\n</head>\n<body>\n<div id="gallery"></div>\n<script src="gallery.js"></script>\n</body>\n</html>\n',
  );
  return page;
}
