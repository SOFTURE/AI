// The panel's rows from the switch views: the page uses them, and an app that builds the panel inside its
// own page shell (`listSwitches` + `SwitchPanel` + `setSwitchAction`) uses the same mapping.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import type { SwitchView } from "../contract.js";
import type { FeatureSwitchesMessages } from "../messages/index.js";
import type { SwitchPanelRow } from "../ui/switch-panel.js";

/** What the mapping reads from the configuration: the stored date is formatted in this locale and time zone. */
export type SwitchSourceConfig = Pick<SoftureConfig, "locale" | "timezone">;

/** The sentence that says where a switch's current value comes from. */
export function describeSwitchSource(view: SwitchView, messages: FeatureSwitchesMessages, config: SwitchSourceConfig): string {
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

/** One `SwitchPanel` row per view, in order; a switch held by its environment override is locked. */
export function toSwitchPanelRows(views: readonly SwitchView[], messages: FeatureSwitchesMessages, config: SwitchSourceConfig): SwitchPanelRow[] {
  return views.map((view) => ({
    name: view.name,
    label: view.label,
    description: view.description,
    isEnabled: view.isEnabled,
    isLocked: view.source === "env",
    note: describeSwitchSource(view, messages, config),
  }));
}
