#!/usr/bin/env node
// @ts-check
// The `softure-theme-css` executable. A checked-in file rather than a file in dist/, so npm links it at install
// time, before the kit is built; it runs after the kit's build (theme packages depend on the kit, which builds
// first). All logic lives in src/cli/command.ts, which the tests call directly.
import { runThemeCssCommand } from "../dist/cli/command.js";

process.exitCode = await runThemeCssCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
