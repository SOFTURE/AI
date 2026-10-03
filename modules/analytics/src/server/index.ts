// Server-only logic: reading and writing the channel tag, counting the funnel and reading its
// report. Framework-free; `next/*` imports are not allowed here (ESLint `no-restricted-imports`, NFR-3).
export { hasChannelParam, isFirstParty, parseChannel, readChannel, withChannel, type ChannelSources } from "./channel.js";
export { handleFunnelBeacon, handleFunnelPixel, MAX_BEACON_BYTES, STEP_FIELD } from "./endpoint.js";
export {
  formatDay,
  getFunnelReport,
  MAX_REPORT_DAYS,
  pruneFunnelCounts,
  recordFunnelStep,
  type AnalyticsContext,
  type FunnelChannel,
  type FunnelReport,
  type FunnelReportRow,
  type RecordFunnelStepInput,
} from "./funnel.js";
export { checkFunnelTable } from "./health.js";
export { getAnalyticsOptions, getChannelOptions, getChannelRule, getFunnelEndpoint } from "./options.js";
