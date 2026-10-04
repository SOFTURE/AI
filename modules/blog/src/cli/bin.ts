#!/usr/bin/env node
// The `softure-blog` executable. All logic lives in command.ts and run.ts, which the tests call directly.
import { runBlogCommand } from "./command.js";

process.exitCode = await runBlogCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
