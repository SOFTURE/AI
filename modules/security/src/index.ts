// Public API of @softure-ai/security: the module factory for softure.config.ts, the client-IP
// resolvers and the body reader. Database work is in `@softure-ai/security/server`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { securityMessages } from "./messages/index.js";
import { securityOptionsSchema } from "./options.js";

export const MODULE_ID = "security";

/**
 * Enables rate limiting in `softure.config.ts`:
 * `security({ clientIp: cloudflareIp(), buckets: { login: { limit: 50, windowMinutes: 15 } } })`.
 */
export const security = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.5",
    dependsOn: {},
    dbSchema: "security",
    tables: ["rate_limits"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  messages: securityMessages,
  options: securityOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
});

export {
  cloudflareIp,
  forwardedForIp,
  headerIp,
  normalizeIp,
  type ClientIpResolver,
  type ForwardedForOptions,
} from "./client-ip.js";
export type { RateLimitAllowance, RateLimitRejection, SecurityErrorCode } from "./contract.js";
export { securityMessages, type SecurityMessages } from "./messages/index.js";
export type { RateLimitBucket, SecurityOptions, SecurityOptionsInput } from "./options.js";
export { readSmallBody, type ReadSmallBodyOptions, type ReadSmallBodyResult } from "./read-small-body.js";
export { rateLimits } from "./schema.js";
