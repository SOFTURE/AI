// @ts-check
// Copies the kit's stylesheets from src/ to dist/ after `tsc`: they are plain CSS, nothing to compile.
//
// Usage: node scripts/copy-css.mjs
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STYLESHEETS = ["preflight.css", "base.css", "maplibre.css"];

for (const name of STYLESHEETS) {
  copyFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), fileURLToPath(new URL(`../dist/${name}`, import.meta.url)));
}
