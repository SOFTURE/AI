// Public API of @softure-ai/alerts: the module factory for softure.config.ts, the channel factories, types and
// messages. `alert` and `resolveAlert` are in `@softure-ai/alerts/server`, the delivery job and the jobs hooks in
// `/jobs`, the mail channel in `/mailing`, `softure-alerts` in `/cli`, the admin page in `/next`, its list in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { alertsMessages } from "./messages/index.js";
import { alertsOptionsSchema } from "./options.js";
import { checkAlertsTable } from "./server/health.js";

export const MODULE_ID = "alerts";

/**
 * Enables alerts in `softure.config.ts`: `alerts({ channels: { ops: slackChannel({ url: process.env.ALERTS_SLACK_URL }) } })`.
 * Needs `jobs` (deliveries run on the `alerts.deliver` queue).
 */
export const alerts = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.1",
    dependsOn: { jobs: "^0.1.6", mailing: "^0.2.5?" },
    dbSchema: "alerts",
    tables: ["alerts"],
    env: [],
    switches: [],
    routes: { panel: "/admin/alerts" },
    mount: [{ kind: "page", path: "app/admin/alerts/page.tsx", export: "AlertsPage" }],
    privacy: { exports: false, deletes: false },
  },
  messages: alertsMessages,
  options: alertsOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkAlertsTable,
});

export {
  defineAlertChannel,
  discordChannel,
  slackChannel,
  telegramChannel,
  toChannelFailure,
  webhookChannel,
  type AlertChannel,
  type AlertChannelContext,
  type AlertChannelOptions,
  type AlertDelivery,
  type AlertDeliveryParts,
  type DeliverAlert,
  type DiscordChannelOptions,
  type SlackChannelOptions,
  type TelegramChannelOptions,
  type WebhookChannelOptions,
} from "./channels.js";
export {
  ALERT_KEY_PATTERN,
  ALERT_MESSAGE_KINDS,
  ALERT_SEVERITIES,
  isAtLeast,
  MAX_DETAILS_LENGTH,
  MAX_LINK_LENGTH,
  MAX_TITLE_LENGTH,
  type AlertInput,
  type AlertMessage,
  type AlertMessageKind,
  type AlertOutcome,
  type AlertRecord,
  type AlertSeverity,
  type AlertsErrorCode,
  type ChannelFailure,
  type ChannelResult,
} from "./contract.js";
export { alertsMessages, type AlertsMessages } from "./messages/index.js";
export { alertsOptionsSchema, CHANNEL_NAME_PATTERN, type AlertsOptions, type AlertsOptionsInput, type AlertsPanelGuard } from "./options.js";
export { getQuietHoursRelease, quietHoursSchema, type QuietHours, type QuietHoursInput } from "./quiet-hours.js";
export { alerts as alertsTable } from "./schema.js";
