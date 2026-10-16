#!/usr/bin/env node
// The `softure-observability` executable. All logic lives in run.ts, which the tests call directly.
import { runObservabilityCli } from "./run.js";

process.exitCode = await runObservabilityCli({
  argv: process.argv.slice(2),
  env: process.env,
  output: { log: (line) => console.log(line), error: (line) => console.error(line) },
});
