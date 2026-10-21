#!/usr/bin/env node
// The `softure-connections` executable. All logic lives in command.ts and run.ts, which the tests call directly.
import { runConnectionsCommand } from "./command.js";

process.exitCode = await runConnectionsCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
