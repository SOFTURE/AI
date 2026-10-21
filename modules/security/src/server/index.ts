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
export { listRateLimitBuckets, type RateLimitBucketEntry } from "./options.js";
export { isPublicAddress } from "./public-address.js";
export {
  GUARDED_REQUEST_DEFAULT_PORTS,
  sendGuardedRequest,
  type GuardedRequestErrorCode,
  type GuardedRequestOptions,
  type GuardedRequestResult,
  type GuardedRequestSeam,
  type ResolveHost,
} from "./guarded-request.js";
export {
  fetchGuardedPage,
  GUARDED_PAGE_DEFAULT_PORTS,
  GUARDED_PAGE_USER_AGENT,
  type GuardedPage,
  type GuardedPageErrorCode,
  type GuardedPageOptions,
  type GuardedPageResult,
} from "./guarded-page.js";
