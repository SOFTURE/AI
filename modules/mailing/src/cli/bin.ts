#!/usr/bin/env node
// The `softure-mail` executable. All logic lives in command.ts and run.ts, which the tests call directly.
import { runMailCommand } from "./command.js";

process.exitCode = await runMailCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
