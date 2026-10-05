// The cache refresh route: `softure-blog publish --commit` calls it so the running app shows the change
// at once instead of after `revalidateSeconds`. Mount it in app/api/blog/refresh/route.ts:
//
//   export { refreshBlogCache as POST } from "@softure-ai/blog/next";
//
// The caller is the command, not a person: no session, so the route checks a Bearer secret from the
// environment (BLOG_REFRESH_SECRET). Order, as in mcp-access: identify the client, count the
// request, check the secret, then expire the tag. Each refusal happens before the next step costs
// anything. security is an optional dependency of the blog, reached through a dynamic import.
import { createHash, timingSafeEqual } from "node:crypto";
import { errorLogLabel, getModule, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidateTag } from "next/cache";
import { BLOG_REFRESH_RATE_LIMIT_BUCKET, BLOG_REFRESH_SECRET_ENV, MIN_REFRESH_SECRET_LENGTH } from "../discovery/refresh.js";
import { getBlogContext } from "./context.js";
import { BLOG_CACHE_TAG } from "./data.js";

const SECURITY_MODULE_ID = "security";
/**
 * The one rate limit key of every caller `identifyClient` cannot place: the command often calls the
 * app on a private name (`--app-url http://web:3000`), past the proxy that sets the client header.
 */
const UNIDENTIFIED_CLIENT_KEY = "unidentified";
const BEARER_PREFIX = /^Bearer[ \t]+/i;
const NO_STORE = { "cache-control": "no-store" };

function answer(status: number, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(null, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * `POST <routes.refresh>`: expires every cached read of the blog, so the next request reads the
 * tables again. Answers 204 refreshed, 401 for a missing or wrong secret, 429 over the `blog-refresh`
 * bucket (per client address; callers without one share a single count), 503 when counting fails,
 * 500 when the secret is not set or shorter than 32 characters. A missing security module or bucket
 * is a setup error, thrown.
 */
export async function refreshBlogCache(request: Request): Promise<Response> {
  const secret = (process.env[BLOG_REFRESH_SECRET_ENV] ?? "").trim();
  if (secret.length < MIN_REFRESH_SECRET_LENGTH) {
    console.error(`@softure-ai/blog: the cache refresh route needs ${BLOG_REFRESH_SECRET_ENV} of at least ${String(MIN_REFRESH_SECRET_LENGTH)} characters`);
    return answer(500);
  }
  const config = getSoftureConfig();
  assertRateLimitBucket(config);
  const { consumeRateLimit, identifyClient } = await import("@softure-ai/security/server");

  const client = identifyClient({ config }, request.headers);
  let limit;
  try {
    // Counted before the secret is checked, so a flood of guesses is stopped first.
    limit = await consumeRateLimit(await getBlogContext(config), { bucket: BLOG_REFRESH_RATE_LIMIT_BUCKET, key: client.ok ? client.value : UNIDENTIFIED_CLIENT_KEY });
  } catch (error) {
    // Fails closed and says nothing: the route is public and this runs before authentication.
    console.error(`@softure-ai/blog: counting a cache refresh failed: ${errorLogLabel(error)}`);
    return answer(503);
  }
  if (!limit.ok) return answer(429, { "retry-after": String(limit.retryAfterSeconds) });

  if (!hasSecret(request.headers.get("authorization"), secret)) return answer(401, { "www-authenticate": "Bearer" });
  // `expire: 0`: the next request waits for fresh reads. The "max" profile would serve the old page once more.
  revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
  return answer(204);
}

/** Compares digests in constant time, so the answer time says nothing about the secret's length or prefix. */
function hasSecret(header: string | null, secret: string): boolean {
  if (header === null || !BEARER_PREFIX.test(header)) return false;
  const given = createHash("sha256").update(header.replace(BEARER_PREFIX, "").trim()).digest();
  return timingSafeEqual(given, createHash("sha256").update(secret).digest());
}

/** A missing module or bucket is a setup bug: thrown, so it reaches the log by name instead of a quiet 503. */
function assertRateLimitBucket(config: SoftureConfig): void {
  const security = getModule(config, SECURITY_MODULE_ID);
  if (security === undefined) {
    throw new Error("@softure-ai/blog: the cache refresh route is rate-limited by the security module; add security() to modules");
  }
  const options = security.options as { buckets?: Record<string, unknown> } | undefined;
  if (options?.buckets?.[BLOG_REFRESH_RATE_LIMIT_BUCKET] === undefined) {
    throw new Error(
      `@softure-ai/blog: the security module has no "${BLOG_REFRESH_RATE_LIMIT_BUCKET}" bucket; spread BLOG_RATE_LIMIT_BUCKETS into security({ buckets })`,
    );
  }
}
