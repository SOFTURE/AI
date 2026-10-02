// Revokes a stored role: `npm run revoke-role -- --email=owner@example.com --role=admin [--commit]`.
import { createRevokeRoleScript } from "@softure-ai/auth/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createRevokeRoleScript(config), argv: process.argv.slice(2), config });
