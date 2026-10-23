// Public API of @softure-ai/security: the module factory for softure.config.ts, the client-IP
// resolvers, the body readers and the signed-request helpers. Database work is in `@softure-ai/security/server`.
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
    version: "0.2.5",
    dependsOn: { jobs: "^0.1.1?" },
    dbSchema: "security",
    tables: ["rate_limits", "webhook_deliveries"],
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
export {
  overrideBuckets,
  RATE_LIMIT_KEY_KINDS,
  type RateLimitBucket,
  type RateLimitBucketInput,
  type RateLimitKeyKind,
  type SecurityOptions,
  type SecurityOptionsInput,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
} from "./options.js";
export {
  readSmallBody,
  readSmallBodyBytes,
  type ReadSmallBodyBytesResult,
  type ReadSmallBodyOptions,
  type ReadSmallBodyResult,
} from "./read-small-body.js";
export { rateLimits, webhookDeliveries } from "./schema.js";
export {
  MIN_SIGNING_SECRET_LENGTH,
  SIGNED_REQUEST_TOLERANCE_SECONDS,
  signRequestBody,
  signWebhookBody,
  signWebhookRequest,
  verifySignedRequest,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_ALGORITHMS,
  WEBHOOK_SENDERS,
  WEBHOOK_SIGNATURE_ENCODINGS,
  type SignRequestBodyInput,
  type SignWebhookBodyInput,
  type SignWebhookRequestInput,
  type SigningSecret,
  type VerifySignedRequestInput,
  type VerifySignedRequestResult,
  type VerifyWebhookSignatureInput,
  type VerifyWebhookSignatureResult,
  type WebhookSender,
  type WebhookSignatureAlgorithm,
  type WebhookSignatureEncoding,
  type WebhookSignatureFormat,
} from "./signed-request.js";
