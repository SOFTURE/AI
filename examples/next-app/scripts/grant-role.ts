// Grants a role to an account: `npm run grant-role -- --email=owner@example.com --role=admin`
// prints what would change; add `--commit` to write it (docs: modules/auth/README.md, "Roles").
import { createGrantRoleScript } from "@softure-ai/auth/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config.ts";

process.exitCode = await runOpsScript({ script: createGrantRoleScript(config), argv: process.argv.slice(2), config });
