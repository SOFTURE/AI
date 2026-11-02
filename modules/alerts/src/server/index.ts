// Server functions of @softure-ai/alerts. Every function receives `{ db, clock, config }` and never reads request
// scope; `next/*` imports are not allowed here (ESLint `no-restricted-imports`).
export {
  alert,
  deliveryPayloadSchema,
  enqueueDeliveries,
  flushAlertRepeats,
  listRecentAlerts,
  resolveAlert,
  type DeliveryPayload,
  type FlushSummary,
  type ListRecentAlertsOptions,
} from "./alert.js";
export { deliverToChannel } from "./deliver.js";
export { checkAlertsTable } from "./health.js";
export {
  alertFromHealthReport,
  type AlertFromHealthReportOptions,
  type HealthAlertSummary,
  type HealthReportLike,
} from "./health-report.js";
export { getAlertsMessages, getAlertsModule, getAlertsOptions, getAlertsRoutes, type AlertsContext } from "./options.js";
export { renderAlert } from "./render.js";
export { ALERTS_DELIVER_QUEUE, ALERTS_FLUSH_QUEUE, isAlertsQueue } from "../queues.js";
