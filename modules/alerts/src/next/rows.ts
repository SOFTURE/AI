// From alert records to the list's rows: the heading, the status label and the detail lines in the app's copy, times
// in the app's time zone.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import type { AlertRecord } from "../contract.js";
import type { AlertsMessages } from "../messages/index.js";
import type { AlertsListRow } from "../ui/alerts-list.js";

export function toAlertsListRows(records: readonly AlertRecord[], messages: AlertsMessages, config: SoftureConfig): AlertsListRow[] {
  const format = new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone });
  return records.map((record) => {
    const isFiring = record.status === "firing";
    const details = [
      formatMessage(messages.page.key, { key: record.key }),
      ...(record.details === null ? [] : [record.details]),
      formatMessage(messages.page.occurrences, { count: record.occurrences }),
      ...(record.pendingRepeats > 0 ? [formatMessage(messages.page.pendingRepeats, { count: record.pendingRepeats })] : []),
      formatMessage(messages.page.lastSeen, { at: format.format(record.lastSeenAt) }),
      ...(record.resolvedAt === null ? [] : [formatMessage(messages.page.resolvedAt, { at: format.format(record.resolvedAt) })]),
    ];
    return {
      key: record.key,
      heading: `${messages.severity[record.severity]}: ${record.title}`,
      severity: record.severity,
      isFiring,
      statusLabel: isFiring ? messages.page.status.firing : messages.page.status.resolved,
      details,
      link: record.link,
    };
  });
}
