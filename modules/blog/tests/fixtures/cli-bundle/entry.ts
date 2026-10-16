// What an app's `scripts/blog.ts` looks like; esbuild bundles it into one file for a container image.
import { runBlogCli } from "@softure-ai/blog/cli";
import config from "./config.js";

process.exitCode = await runBlogCli({ config, argv: process.argv.slice(2) });
