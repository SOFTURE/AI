// `@softure-ai/billing/scripts`: ops scripts that grant a plan, revoke a manual grant, extend a
// trial, import entitlements and pin derived trials (see the README, "Scripts" and "Existing accounts").
export {
  createImportEntitlementsScript,
  createPinTrialsScript,
  MAX_IMPORT_ROWS,
  type EntitlementScriptOptions,
  type ImportEntitlementsScriptArgs,
  type PinTrialsScriptArgs,
} from "./entitlement-scripts.js";
export { createGrantPlanScript, createRevokeGrantScript, type GrantPlanScriptArgs, type PlanScriptOptions, type RevokeGrantScriptArgs } from "./plan-scripts.js";
export { createExtendTrialScript, MAX_EXTEND_DAYS, type ExtendTrialScriptArgs, type TrialScriptOptions } from "./trial-scripts.js";
