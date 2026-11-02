// The admin page, ready to mount with one line: `export { AlertsPage as default } from "@softure-ai/alerts/next"`.
// A server component: anyone without the panel role, signed in or not, gets Next's "not found", and so does everyone
// while the app has not passed `panelGuard`.
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import { Card } from "@softure-ai/ui";
import { notFound } from "next/navigation";
import { listRecentAlerts } from "../server/alert.js";
import { getAlertsMessages, getAlertsOptions } from "../server/options.js";
import { AlertsList } from "../ui/alerts-list.js";
import { toAlertsListRows } from "./rows.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";
const RECENT_ALERTS_LIMIT = 100;

export async function AlertsPage() {
  const config = getSoftureConfig();
  const options = getAlertsOptions(config);
  if (options.panelGuard === undefined) notFound();
  await options.panelGuard.requireRole(options.panelRole);
  if (config.database === null) {
    throw new Error("@softure-ai/alerts: softure.config.ts has no database; alerts needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  const messages = getAlertsMessages(config);
  const records = await listRecentAlerts({ db }, { limit: RECENT_ALERTS_LIMIT });
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead}>
        <AlertsList rows={toAlertsListRows(records, messages, config)} messages={messages} />
      </Card>
    </main>
  );
}
