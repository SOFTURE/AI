#!/usr/bin/env node
// The `softure` executable. All logic lives in command.ts, which the tests call directly.
import { runSoftureCommand } from "./command.js";

process.exitCode = await runSoftureCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
