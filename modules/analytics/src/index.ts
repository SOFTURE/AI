// Public API of @softure-ai/analytics: the module factory for softure.config.ts, its options and
// types. Reading the channel is in `@softure-ai/analytics/server`, the proxy piece for the app's
// `proxy.ts` in `/proxy`, and the Next.js adapter (`getChannel`, `attributeRegistration`) in `/next`.
import { defineModule } from "@softure-ai/core";
import { analyticsMessages } from "./messages/index.js";
import { analyticsOptionsSchema } from "./options.js";

export const MODULE_ID = "analytics";

/**
 * Enables the analytics module in `softure.config.ts`:
 * `analytics({ channel: { param: "z", pattern: /^[a-z0-9-]+$/, maxLength: 32 } })` (every key optional).
 */
export const analytics = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [{ kind: "middleware", path: "proxy.ts", export: "createChannelTagger" }],
    privacy: { exports: false, deletes: false },
  },
  messages: analyticsMessages,
  options: analyticsOptionsSchema,
});

export { analyticsMessages, type AnalyticsMessages } from "./messages/index.js";
export {
  DEFAULT_CHANNEL_PATTERN,
  MAX_CHANNEL_LENGTH,
  PARAM_PATTERN,
  type AnalyticsOptions,
  type AnalyticsOptionsInput,
  type ChannelOptions,
} from "./options.js";
