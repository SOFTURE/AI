#!/usr/bin/env node
// The `softure-mcp` executable. All logic lives in command.ts and run.ts, which the tests call directly.
import { runMcpAccessCommand } from "./command.js";

process.exitCode = await runMcpAccessCommand({ argv: process.argv.slice(2), cwd: process.cwd() });
