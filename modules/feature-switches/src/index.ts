// Public API of @softure-ai/feature-switches: the module factory for softure.config.ts, its types,
// messages and table. Database work is in `@softure-ai/feature-switches/server`, the Next.js
// adapter (isEnabled per request, the panel page and its action) in `/next`, the panel in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { featureSwitchesMessages } from "./messages/index.js";
import { featureSwitchesOptionsSchema } from "./options.js";
import { checkSwitchesTable } from "./server/health.js";
import { switchesPrivacyContributor } from "./server/privacy.js";
import { readDeclaredSwitch } from "./server/reader.js";

export const MODULE_ID = "feature-switches";

/**
 * Enables runtime switches in `softure.config.ts` (after `auth({ ... })`, which guards the panel):
 * `featureSwitches({ switches: [{ name: "billing.checkout_enabled", default: false }] })`.
 * The module is the app's switch provider: other modules read the switches they name in their
 * manifests through `readSwitch` of `@softure-ai/core` once the app defines them here.
 */
export const featureSwitches = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { auth: "^0.0.0" },
    dbSchema: "features",
    tables: ["switches"],
    env: [],
    switches: [],
    routes: { panel: "/admin/switches" },
    mount: [{ kind: "page", path: "app/admin/switches/page.tsx", export: "SwitchesPage" }],
    privacy: { exports: true, deletes: true },
  },
  messages: featureSwitchesMessages,
  options: featureSwitchesOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: switchesPrivacyContributor,
  health: checkSwitchesTable,
  switchReader: readDeclaredSwitch,
});

export type { FeatureSwitchesErrorCode, SwitchFormErrorCode, SwitchFormState, SwitchSource, SwitchView } from "./contract.js";
export { featureSwitchesMessages, getSwitchErrorMessage, type FeatureSwitchesMessages } from "./messages/index.js";
export {
  getSwitchEnvName,
  MAX_SWITCH_NAME_LENGTH,
  SWITCH_NAME_PATTERN,
  type FeatureSwitchesOptions,
  type FeatureSwitchesOptionsInput,
  type SwitchDefinition,
  type SwitchDefinitionInput,
  type SwitchFailMode,
} from "./options.js";
export { switches } from "./schema.js";
