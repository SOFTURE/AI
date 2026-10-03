// Server-only API of @softure-ai/feature-switches. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope.
export { checkSwitchesTable } from "./health.js";
export { readEnvOverride, type Env, type EnvOverride } from "./env-override.js";
export {
  deleteSwitchesUserData,
  exportSwitchesUserData,
  switchesPrivacyContributor,
  type SwitchesUserData,
} from "./privacy.js";
export { findSwitchDefinition, getFeatureSwitchesOptions, getSwitchDefinition, getSwitchDefinitions } from "./options.js";
export {
  isEnabled,
  listSwitches,
  readStoredSwitches,
  resolveSwitchValue,
  setSwitch,
  type SetSwitchInput,
  type StoredSwitch,
  type StoredSwitches,
  type SwitchContext,
  type SwitchValue,
} from "./switches.js";
