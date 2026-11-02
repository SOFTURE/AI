// Server-only API of @softure-ai/metering. Every function receives the module context (`{ db, clock, config }`)
// and never reads request scope.
export {
  createFootageChargeRecorder,
  createLlmUsageRecorder,
  recordLlmUsage,
  type FootageChargeLike,
  type FootageChargeRecorder,
  type FootageChargeRecorderOptions,
  type LlmUsageAdapterOptions,
  type LlmUsageLike,
} from "./adapters.js";
export { checkChargesTable } from "./health.js";
export { getMeteringOptions, getProviderDefinition } from "./options.js";
export { getPeriodBounds, type PeriodBounds } from "./periods.js";
export {
  deleteMeteringUserData,
  exportMeteringUserData,
  meteringPrivacyContributor,
  type ExportedCharge,
  type MeteringDeletionReport,
  type MeteringPrivacyContext,
  type MeteringUserData,
} from "./privacy.js";
export { MIN_KEEP_DAYS, pruneCharges, type PruneChargesInput, type PruneChargesReport } from "./prune.js";
export {
  getSpend,
  recordCharge,
  releaseSpend,
  reserveSpend,
  settleSpend,
  type ChargeAttributes,
  type ChargeInput,
  type MeteringContext,
  type SpendInput,
  type SpendQuery,
} from "./spend.js";
