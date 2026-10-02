// Server-only API of @softure-ai/security. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; headers come in as a value.
export { identifyClient, subjectKey } from "./identify.js";
export {
  consumeRateLimit,
  pruneRateLimits,
  resetRateLimit,
  type RateLimitResult,
  type RateLimitTarget,
  type SecurityContext,
} from "./rate-limit.js";
