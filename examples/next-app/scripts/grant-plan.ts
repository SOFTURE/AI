// Grants a plan by hand: `npm run grant-plan -- --email=member@example.com --plan=monthly` prints
// what would change; add `--commit` to write it (docs: modules/billing/README.md, "Scripts").
import { createGrantPlanScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createGrantPlanScript(config), argv: process.argv.slice(2), config });
