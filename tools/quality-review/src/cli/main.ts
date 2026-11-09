#!/usr/bin/env node
// Entry point of the `softure-quality-review` bin; the behaviour is in command.ts.
import { runCommand } from "./command.js";

process.exitCode = await runCommand(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  write: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
});
