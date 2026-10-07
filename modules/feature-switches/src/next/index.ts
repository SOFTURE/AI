// The Next.js adapter of @softure-ai/feature-switches: `isEnabled` per request, the panel page and
// its server action (docs/02-module-standard.md §8).
export { setSwitchAction } from "./actions.js";
export { isEnabled } from "./is-enabled.js";
export { getFeatureSwitchesMessages } from "./messages.js";
export { SwitchesPage } from "./pages.js";
export { describeSwitchSource, toSwitchPanelRows, type SwitchSourceConfig } from "./panel-rows.js";
