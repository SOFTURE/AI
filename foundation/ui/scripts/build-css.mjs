// @ts-check
// Compiles the package's CSS after `tsc` (docs/02-module-standard.md §5, NFR-7):
// - `styles.css`: the default tokens and the utilities the components use, all inside
//   `@layer softure`, compiled by the Tailwind 4 CLI from `src/ui/`;
// - `tailwind.css`: the `@theme inline` bridge for an app's own Tailwind 4.
// Token CSS comes from the built theme module, so TypeScript stays the only source of the contract.
//
// Usage: node scripts/build-css.mjs [distDir]   (default: the package's dist/, after tsc)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

/** NFR-7: the compiled CSS of one module is at most 20 kB gzip. */
export const SIZE_BUDGET_BYTES = 20 * 1024;

/**
 * Softure sits above the app's resets (`base`) and below the app's own components and utilities,
 * so an app class always wins. Layer order is fixed where a layer is first declared, so this must
 * be the first statement the browser sees: the app imports styles.css before Tailwind.
 */
export const LAYER_ORDER = "@layer theme, base, softure, components, utilities;";

// Values Tailwind needs that are not tokens. Without a theme value a utility compiles to nothing,
// silently, so every namespace the components use is listed here:
// - `--spacing` is the base of the numeric scale (`sft:h-10` = 2.5rem); `space-1…8` tokens still win
//   for steps 1 to 8, so padding and gaps follow the theme;
// - weights, line heights and tracking belong to a font, not to a theme;
// - one breakpoint (`sft:sm:`), two container widths (modal panels) and the spinner animation.
const STATIC_THEME = `@theme inline reference prefix(sft) {
  --spacing: 0.25rem;
  --spacing-0: 0px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --leading-none: 1;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --tracking-tight: -0.025em;
  --breakpoint-sm: 40rem;
  --container-md: 28rem;
  --container-3xl: 48rem;
  --animate-spin: sft-spin 1s linear infinite;
}`;

/** Keyframes of `--animate-*`; a `reference` theme emits none of its own. */
const KEYFRAMES = `@keyframes sft-spin {
  to {
    transform: rotate(360deg);
  }
}`;

/**
 * @typedef {object} ThemeModule
 * @property {(theme: object, options?: { fallback?: boolean }) => string} buildThemeCss
 * @property {(options?: { prefix?: string }) => string} buildTailwindTheme
 * @property {object} DEFAULT_THEME
 */

/**
 * The Tailwind input for styles.css.
 * @param {ThemeModule} theme
 * @param {string} sourceDir the components to scan
 */
export function buildStylesInput(theme, sourceDir) {
  return [
    LAYER_ORDER,
    `@import "tailwindcss/utilities.css" layer(softure) source(none);`,
    `@source ${JSON.stringify(sourceDir)};`,
    theme.buildTailwindTheme({ prefix: "sft" }),
    STATIC_THEME,
    `@layer softure {\n${theme.buildThemeCss(theme.DEFAULT_THEME, { fallback: true })}\n}`,
    `@layer softure {\n${KEYFRAMES}\n}`,
    "",
  ].join("\n");
}

/**
 * Builds styles.css and tailwind.css into `outDir`.
 * @param {{ outDir: string, theme: ThemeModule }} options `theme` is the built (or, in tests, source) theme module
 * @returns {{ gzipBytes: number }}
 */
export function buildCss({ outDir, theme }) {
  // The input lives inside the package so `@import "tailwindcss/…"` resolves from its node_modules.
  const workDir = mkdtempSync(join(PACKAGE_DIR, ".css-build-"));
  try {
    const input = join(workDir, "styles.input.css");
    writeFileSync(input, buildStylesInput(theme, join(PACKAGE_DIR, "src/ui")));
    const cli = getTailwindCli();
    execFileSync(process.execPath, [cli, "-i", input, "-o", join(outDir, "styles.css"), "--minify"], {
      cwd: PACKAGE_DIR,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, "tailwind.css"), `${theme.buildTailwindTheme()}\n`);
  return { gzipBytes: gzipSync(readFileSync(join(outDir, "styles.css"))).length };
}

/** The Tailwind CLI entry, from the bin field of its package (the package exports nothing else). */
function getTailwindCli() {
  const manifestPath = createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json");
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const bin = isRecord(manifest) && isRecord(manifest.bin) ? manifest.bin.tailwindcss : undefined;
  if (typeof bin !== "string") throw new Error(`No tailwindcss bin in ${manifestPath}`);
  return join(dirname(manifestPath), bin);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // After `tsc`: the built theme module is the token source.
  const distDir = resolve(process.argv[2] ?? join(PACKAGE_DIR, "dist"));
  /** @type {unknown} */
  const built = await import(pathToFileURL(join(distDir, "theme/index.js")).href);
  const theme = /** @type {ThemeModule} */ (built);
  const { gzipBytes } = buildCss({ outDir: distDir, theme });
  const size = `${(gzipBytes / 1024).toFixed(1)} kB gzip (budget ${SIZE_BUDGET_BYTES / 1024} kB, NFR-7)`;
  if (gzipBytes > SIZE_BUDGET_BYTES) {
    console.error(`@softure-ai/ui styles.css is ${size}`);
    process.exit(1);
  }
  console.log(`@softure-ai/ui styles.css: ${size}`);
}
