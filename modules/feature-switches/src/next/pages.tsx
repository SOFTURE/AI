// The panel page, ready to mount with one line:
// `export { SwitchesPage as default } from "@softure-ai/feature-switches/next"`.
// A server component: anyone without the panel role, signed in or not, gets Next's "not found".
// It renders its own `<main>` and title; an app with its own page shell composes the same parts
// (README §4): `listSwitches`, `toSwitchPanelRows`, `SwitchPanel` and `setSwitchAction`.
import { requireRole } from "@softure-ai/auth/next";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { getFeatureSwitchesOptions } from "../server/options.js";
import { listUndefinedManifestSwitches } from "../server/reader.js";
import { listSwitches } from "../server/switches.js";
import { SwitchPanel } from "../ui/switch-panel.js";
import { setSwitchAction } from "./actions.js";
import { getSwitchContext } from "./context.js";
import { getFeatureSwitchesMessages } from "./messages.js";
import { toSwitchPanelRows } from "./panel-rows.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";

export async function SwitchesPage() {
  const config = getSoftureConfig();
  await requireRole(getFeatureSwitchesOptions(config).panelRole);
  const messages = getFeatureSwitchesMessages(config);
  const views = await listSwitches(await getSwitchContext(config));
  const rows = toSwitchPanelRows(views, messages, config);
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.panel.title} subtitle={messages.panel.lead}>
        <SwitchPanel switches={rows} undefinedSwitches={listUndefinedManifestSwitches(config)} action={setSwitchAction} messages={messages} locale={config.locale} />
      </Card>
    </main>
  );
}
