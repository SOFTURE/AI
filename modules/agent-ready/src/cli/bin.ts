#!/usr/bin/env node
// The `agent-ready` executable. All logic lives in run.ts, which the tests call directly.
import { runAgentReadyCli } from "./run.js";

process.exitCode = await runAgentReadyCli({ argv: process.argv.slice(2) });
