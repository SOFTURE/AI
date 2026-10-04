// The blog's command for this app: `npm run blog:publish -- [<path>...] [--commit]`. It loads the
// config itself (path aliases and `.ts` imports), as the @softure-ai/blog README recommends.
import { runBlogCli } from "@softure-ai/blog/cli";
import config from "../softure.config.ts";

process.exitCode = await runBlogCli({ config, argv: process.argv.slice(2) });
