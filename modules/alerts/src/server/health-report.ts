// From a health report to alerts: a failing check fires `health:<name>`, a passing one resolves it. The report type
// is structural (`@softure-ai/ops`' `HealthReport` fits), so this module does not depend on ops.
import { formatMessage, ok, type Result } from "@softure-ai/core";
import type { AlertSeverity } from "../contract.js";
import { alert, resolveAlert } from "./alert.js";
import { getAlertsMessages, type AlertsContext } from "./options.js";

/** What `runHealthChecks` of `@softure-ai/ops/server` answers: each check's state by name. */
export interface HealthReportLike {
  readonly checks: Readonly<Record<string, string>>;
}

export interface AlertFromHealthReportOptions {
  /** Default `critical`: a failing health check means the app does not serve. */
  readonly severity?: AlertSeverity;
  /** Default `health:`; the key is the prefix and the check's name. */
  readonly keyPrefix?: string;
  /** Where the operator looks, e.g. the app's `/api/health`. */
  readonly link?: string;
}

export interface HealthAlertSummary {
  /** Checks that fired or repeated a message now. */
  readonly alerted: readonly string[];
  /** Checks whose alert this call resolved. */
  readonly resolved: readonly string[];
}

/**
 * Alerts every check of `report` that is not `ok` and resolves every one that is. Run it from a scheduled job that
 * runs the checks (README §10), not from the health route: the route answers a load balancer many times a minute.
 */
export async function alertFromHealthReport(
  ctx: AlertsContext,
  report: HealthReportLike,
  options: AlertFromHealthReportOptions = {},
): Promise<Result<HealthAlertSummary, "alerts.invalid_input">> {
  const messages = getAlertsMessages(ctx.config);
  const prefix = options.keyPrefix ?? "health:";
  const alerted: string[] = [];
  const resolved: string[] = [];
  for (const [name, state] of Object.entries(report.checks)) {
    const key = `${prefix}${name}`;
    if (state === "ok") {
      if (await resolveAlert(ctx, key)) resolved.push(name);
      continue;
    }
    const result = await alert(ctx, {
      key,
      severity: options.severity ?? "critical",
      title: formatMessage(messages.health.title, { name, state }),
      ...(options.link === undefined ? {} : { link: options.link }),
    });
    if (!result.ok) return result;
    if (result.value !== "counted") alerted.push(name);
  }
  return ok({ alerted, resolved });
}
