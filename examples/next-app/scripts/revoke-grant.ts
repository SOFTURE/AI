// Revokes a manual plan grant: `npm run revoke-grant -- --email=member@example.com --grant=<id> [--commit]`.
import { createRevokeGrantScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createRevokeGrantScript(config), argv: process.argv.slice(2), config });
