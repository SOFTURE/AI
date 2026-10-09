// `@softure-ai/ops/scripts`: the helper for safe ops scripts (dry run by default, `--commit` writes,
// one transaction, a guard test through `executeOpsScript`).
export {
  defineOpsScript,
  executeOpsScript,
  parseOpsArguments,
  refuseOpsScript,
  runOpsMain,
  runOpsScript,
  type OpsInputReader,
  type OpsRefusal,
  type OpsReport,
  type OpsScript,
  type OpsScriptOutcome,
  type RunOpsMainOptions,
  type RunOpsScriptOptions,
} from "./ops-script.js";
