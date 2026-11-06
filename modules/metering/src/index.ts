// Public API of @softure-ai/metering: the module factory for softure.config.ts, its types, messages and table.
// The ledger functions are in `@softure-ai/metering/server`, the prune job in `/jobs`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { meteringMessages } from "./messages/index.js";
import { meteringOptionsSchema } from "./options.js";
import { checkChargesTable } from "./server/health.js";
import { meteringPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "metering";

/**
 * Enables the spend ledger in `softure.config.ts`:
 * `metering({ providers: [{ id: "elevenlabs", unit: "credits", budgets: [{ period: "month", limit: 100_000 }] }] })`.
 */
export const metering = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.4.0",
    dependsOn: { jobs: "^0.1.6?" },
    dbSchema: "metering",
    tables: ["charges", "budget_limits"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: true, deletes: true },
  },
  messages: meteringMessages,
  options: meteringOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: meteringPrivacyContributor,
  health: checkChargesTable,
});

export {
  METERING_UNITS,
  type BudgetExceeded,
  type BudgetKey,
  type BudgetLimit,
  type BudgetPeriod,
  type BudgetScope,
  type BudgetState,
  type ChargeRate,
  type MeteringErrorCode,
  type MeteringUnit,
  type SpendBreakdown,
  type SpendBreakdownRow,
  type SpendFilter,
  type SpendGroupBy,
  type SpendReservation,
  type SpendSummary,
} from "./contract.js";
export { getMeteringErrorMessage, meteringMessages, type MeteringMessages } from "./messages/index.js";
export {
  MAX_PROVIDER_ID_LENGTH,
  PROVIDER_ID_PATTERN,
  type BudgetDefinition,
  type MeteringOptions,
  type MeteringOptionsInput,
  type ProviderDefinition,
  type ProviderDefinitionInput,
} from "./options.js";
export { budgetLimits, charges } from "./schema.js";
