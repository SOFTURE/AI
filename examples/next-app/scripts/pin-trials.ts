// Pins every derived trial into a row before `trial.days`, `trial.startsAt` or the time zone
// changes: `npm run pin-trials [-- --commit]` (docs: modules/billing/README.md, "Existing accounts").
import { createPinTrialsScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createPinTrialsScript(config), argv: process.argv.slice(2), config });
