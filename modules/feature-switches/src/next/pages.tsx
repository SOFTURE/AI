// The panel page, ready to mount with one line:
// `export { SwitchesPage as default } from "@softure-ai/feature-switches/next"`.
// A server component: anyone without the panel role, signed in or not, gets Next's "not found".
import { requireRole } from "@softure-ai/auth/next";
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import type { SwitchView } from "../contract.js";
import type { FeatureSwitchesMessages } from "../messages/index.js";
import { getFeatureSwitchesOptions } from "../server/options.js";
import { listSwitches } from "../server/switches.js";
import { SwitchPanel, type SwitchPanelRow } from "../ui/switch-panel.js";
import { setSwitchAction } from "./actions.js";
import { getSwitchContext } from "./context.js";
import { getFeatureSwitchesMessages } from "./messages.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";

function describeSource(view: SwitchView, messages: FeatureSwitchesMessages, config: SoftureConfig): string {
  switch (view.source) {
    case "env":
      return formatMessage(messages.source.env, { envName: view.envName });
    case "stored": {
      const format = new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone });
      return formatMessage(messages.source.stored, { date: view.updatedAt === null ? "" : format.format(view.updatedAt) });
    }
    case "default":
      return messages.source.default;
    case "fail-mode":
      return messages.source.failMode;
  }
}

export async function SwitchesPage() {
  const config = getSoftureConfig();
  await requireRole(getFeatureSwitchesOptions(config).panelRole);
  const messages = getFeatureSwitchesMessages(config);
  const views = await listSwitches(await getSwitchContext(config));
  const rows: SwitchPanelRow[] = views.map((view) => ({
    name: view.name,
    label: view.label,
    description: view.description,
    isEnabled: view.isEnabled,
    isLocked: view.source === "env",
    note: describeSource(view, messages, config),
  }));
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.panel.title} subtitle={messages.panel.lead}>
        <SwitchPanel switches={rows} action={setSwitchAction} messages={messages} locale={config.locale} />
      </Card>
    </main>
  );
}
