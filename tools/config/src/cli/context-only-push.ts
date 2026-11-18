#!/usr/bin/env node
// Entry point of the `softure-context-only-push` bin; the behaviour is in context-only-push-command.ts.
import { isContextOnlyPush, parseSinceOption, runGitCommand } from "./context-only-push-command.js";

const options = parseSinceOption(process.argv.slice(2));
if (options === null) {
  console.error("usage: softure-context-only-push [--since <rev>]");
  process.exitCode = 2;
} else {
  process.exitCode = isContextOnlyPush(process.cwd(), runGitCommand, options.since) ? 0 : 1;
}
