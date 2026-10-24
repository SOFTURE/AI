#!/usr/bin/env node
// @ts-check
// The `softure-theme-css` executable. A checked-in file rather than a file in dist/, so npm links it at install
// time, before the kit is built; it runs after the kit's build (theme packages depend on the kit, which builds
// first). The command is loaded by URL, so the type check does not need dist/ either. All logic lives in
// src/cli/command.ts, which the tests call directly.

/** @typedef {{ runThemeCssCommand: (input: { argv: string[]; cwd: string }) => Promise<number> }} CommandModule */

/** @type {unknown} */
const loaded = await import(new URL("../dist/cli/command.js", import.meta.url).href);
const commandModule = /** @type {CommandModule} */ (loaded);

process.exitCode = await commandModule.runThemeCssCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
