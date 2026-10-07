// Public API of @softure-ai/ops: the module factory for softure.config.ts. The health route is in
// `@softure-ai/ops/next`, the check runner in `@softure-ai/ops/server`, and the safe ops script
// helper in `@softure-ai/ops/scripts`.
import { defineModule } from "@softure-ai/core";
import { opsMessages } from "./messages/index.js";
import { opsOptionsSchema } from "./options.js";

export const MODULE_ID = "ops";

/**
 * Enables the health endpoint in `softure.config.ts`: `ops()`, or with the app's own checks
 * `ops({ checks: { "app.queue": checkQueue } })`. Mount it in `app/api/health/route.ts`:
 * `export { GET } from "@softure-ai/ops/next"`.
 */
export const ops = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.7",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: { health: "/api/health" },
    mount: [{ kind: "route-handler", path: "app/api/health/route.ts" }],
    privacy: { exports: false, deletes: false },
  },
  messages: opsMessages,
  options: opsOptionsSchema,
});

export type { HealthCheckState, HealthReport, HealthStatus } from "./contract.js";
export { opsMessages, type OpsMessages } from "./messages/index.js";
export type { OpsOptions, OpsOptionsInput } from "./options.js";
