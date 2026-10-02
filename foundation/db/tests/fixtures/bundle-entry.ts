// What an app's `scripts/migrate.ts` looks like; esbuild bundles it for a container image.
import { runMigrateCli } from "@softure-ai/db/cli";
import config from "./bundle-config.js";

process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2) });
