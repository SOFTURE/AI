// The jobs queues the module uses. An app defines them in `jobs({ queues, schedules })` with
// `alertsJobQueues` and `alertsJobSchedules` from `@softure-ai/alerts/jobs`.

/** One delivery per channel and message; a channel outage retries here and never blocks the caller. */
export const ALERTS_DELIVER_QUEUE = "alerts.deliver";
/** Sends the summary of repeats nobody reported yet, and prunes old resolved alerts. */
export const ALERTS_FLUSH_QUEUE = "alerts.flush";

/** True for the module's own queues: their failures must never raise another alert. */
export function isAlertsQueue(queue: string): boolean {
  return queue === ALERTS_DELIVER_QUEUE || queue === ALERTS_FLUSH_QUEUE;
}
