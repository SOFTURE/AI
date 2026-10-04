// Imports what another system knew about existing accounts (trial ends, paid periods, lifetime):
// `npm run import-entitlements -- --file=entitlements.json [--commit]` (docs: modules/billing/README.md,
// "Existing accounts").
import { createImportEntitlementsScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createImportEntitlementsScript(config), argv: process.argv.slice(2), config });
