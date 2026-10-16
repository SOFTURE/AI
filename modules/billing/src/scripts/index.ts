// `@softure-ai/billing/scripts`: ops scripts that grant a plan or lifetime access, revoke a manual
// grant, extend a trial, import entitlements, pin derived trials, and show one account's status
// without writing (see the README, "Scripts" and "Existing accounts").
export {
  createImportEntitlementsScript,
  createPinTrialsScript,
  MAX_IMPORT_ROWS,
  type EntitlementScriptOptions,
  type ImportEntitlementsScriptArgs,
  type PinTrialsScriptArgs,
} from "./entitlement-scripts.js";
export {
  createGrantLifetimeScript,
  createGrantPlanScript,
  createRevokeGrantScript,
  type GrantLifetimeScriptArgs,
  type GrantPlanScriptArgs,
  type PlanScriptOptions,
  type RevokeGrantScriptArgs,
} from "./plan-scripts.js";
export { createExtendTrialScript, MAX_EXTEND_DAYS, type ExtendTrialScriptArgs, type TrialScriptOptions } from "./trial-scripts.js";
export { createEntitlementStatusScript, type EntitlementStatusReport, type EntitlementStatusScriptArgs } from "./status-script.js";
