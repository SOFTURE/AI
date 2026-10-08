// Extends a trial: `npm run extend-trial -- --email=member@example.com --days=30 [--commit]`
// (or `--user=<id>`, `--until=YYYY-MM-DD`; docs: modules/billing/README.md, "Scripts").
import { createExtendTrialScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createExtendTrialScript(config), argv: process.argv.slice(2), config });
