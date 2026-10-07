// Public API of @softure-ai/analytics: the module factory for softure.config.ts, its options,
// types and the funnel table. Reading the channel and counting the funnel are in
// `@softure-ai/analytics/server`, the proxy piece for the app's `proxy.ts` in `/proxy`, the
// Next.js adapter (`getChannel`, `attributeRegistration`, `countRegistration`, the funnel route,
// `<FunnelPixel>`, `<FunnelBeacon>`) in `/next`, and the browser's beacon in `/client`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { analyticsMessages } from "./messages/index.js";
import { analyticsOptionsSchema } from "./options.js";
import { checkFunnelTable } from "./server/health.js";

export const MODULE_ID = "analytics";

/**
 * Enables the analytics module in `softure.config.ts` (every key optional):
 * `analytics({ channel: { param: "z" }, funnel: { steps: [{ id: "landing", via: "pixel" }, { id: "signup", via: "server" }] } })`.
 */
export const analytics = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.5",
    dependsOn: { security: "^0.1.0?" },
    dbSchema: "analytics",
    tables: ["funnel_counts"],
    env: [],
    switches: [],
    routes: { funnel: "/api/analytics/funnel" },
    mount: [
      { kind: "middleware", path: "proxy.ts", export: "createChannelTagger" },
      { kind: "route-handler", path: "app/api/analytics/funnel/route.ts", export: "createFunnelRoute" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: analyticsMessages,
  options: analyticsOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkFunnelTable,
});

export { analyticsMessages, type AnalyticsMessages } from "./messages/index.js";
export {
  DEFAULT_CHANNEL_CAP,
  DEFAULT_CHANNEL_PATTERN,
  FUNNEL_STEP_SOURCES,
  MAX_CHANNEL_LENGTH,
  MAX_STEP_LENGTH,
  MAX_STEPS,
  OVERFLOW_CHANNEL,
  PARAM_PATTERN,
  STEP_PATTERN,
  type AnalyticsOptions,
  type AnalyticsOptionsInput,
  type ChannelOptions,
  type FunnelOptions,
  type FunnelStep,
  type FunnelStepSource,
} from "./options.js";
export { analyticsSchema, funnelCounts } from "./schema.js";
