// The migrate step of the container image (docs: modules/ops/README.md, "Container recipe").
// esbuild bundles this file into migrate.mjs in the build stage; the image runs it once before the
// app starts: `node migrate.mjs --migrations-dir ./softure-migrations`.
import { runMigrateCli } from "@softure-ai/db/cli";
import config from "../softure.config.ts";

process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2) });
