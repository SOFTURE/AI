// The cache refresh after a publish: the command runs outside the app and cannot reach Next's cache,
// so it asks the running app, through the route `refreshBlogCache` (`@softure-ai/blog/next`), to
// expire the blog's cached reads. Both sides read one secret from the environment.
import type { SoftureConfig } from "@softure-ai/core";
import { getBlogOptions, getBlogRefreshPath } from "../server/options.js";
import type { IndexNowChange } from "./indexnow.js";

/** The variable both the route and the command read the shared secret from. */
export const BLOG_REFRESH_SECRET_ENV = "BLOG_REFRESH_SECRET";
/** A shorter secret is a setup bug: the route refuses to run with it and the command does not send it. */
export const MIN_REFRESH_SECRET_LENGTH = 32;
/** The security bucket the route counts in; `BLOG_RATE_LIMIT_BUCKETS` holds its default. */
export const BLOG_REFRESH_RATE_LIMIT_BUCKET = "blog-refresh";

const DEFAULT_TIMEOUT_MS = 10_000;

export type BlogRefreshFailure = "blog.refresh_invalid_secret" | "blog.refresh_unreachable" | "blog.refresh_rejected";

export type BlogRefreshOutcome =
  /** No secret in the environment: the app shows the change after `revalidateSeconds`. */
  | { readonly kind: "not_configured"; readonly revalidateSeconds: number }
  /** The run changed no text. */
  | { readonly kind: "skipped" }
  /** No commit: the address a commit would call, and no request. */
  | { readonly kind: "dry_run"; readonly url: string }
  | { readonly kind: "refreshed"; readonly url: string }
  | { readonly kind: "failed"; readonly code: BlogRefreshFailure; readonly reason: string; readonly revalidateSeconds: number };

export interface RequestBlogRefreshOptions {
  /** Sends the request only when `true`, i.e. after a committed run; otherwise a dry run. */
  readonly commit?: boolean;
  /** The app's origin to call, when it differs from `appOrigin` (a private name in a container). */
  readonly appUrl?: string;
  /** Default: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

/**
 * Asks the running app to refresh the blog's cache after a publish run. Call it before the IndexNow
 * submit, so a crawler that answers the ping finds the new text. Never throws for an expected
 * failure: the refresh is an extra after a publish and must not undo it.
 */
export async function requestBlogRefresh(config: SoftureConfig, changes: readonly IndexNowChange[], options: RequestBlogRefreshOptions = {}): Promise<BlogRefreshOutcome> {
  const { revalidateSeconds } = getBlogOptions(config);
  if (changes.every((change) => change.action === "unchanged")) return { kind: "skipped" };
  const secret = ((options.env ?? process.env)[BLOG_REFRESH_SECRET_ENV] ?? "").trim();
  if (secret === "") return { kind: "not_configured", revalidateSeconds };

  // Also on a dry run: the editor learns of a short secret before the commit that needs it.
  if (secret.length < MIN_REFRESH_SECRET_LENGTH) {
    return { kind: "failed", code: "blog.refresh_invalid_secret", reason: `${BLOG_REFRESH_SECRET_ENV} must be at least ${String(MIN_REFRESH_SECRET_LENGTH)} characters`, revalidateSeconds };
  }
  const url = new URL(getBlogRefreshPath(config), options.appUrl ?? config.appOrigin).toString();
  if (options.commit !== true) return { kind: "dry_run", url };

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      // Never followed: a redirect would carry the request, or drop the secret, somewhere else.
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (response.status === 204 || response.status === 200) return { kind: "refreshed", url };
    return { kind: "failed", code: "blog.refresh_rejected", reason: `${url} answered ${String(response.status)}${describeStatus(response.status)}`, revalidateSeconds };
  } catch (error) {
    return { kind: "failed", code: "blog.refresh_unreachable", reason: `${url} could not be reached: ${error instanceof Error ? error.message : String(error)}`, revalidateSeconds };
  }
}

function describeStatus(status: number): string {
  if (status === 401) return ` (the app has another ${BLOG_REFRESH_SECRET_ENV})`;
  if (status === 404) return " (mount refreshBlogCache at that path)";
  if (status === 429) return " (too many refreshes from this address)";
  if (status >= 300 && status < 400) return " (a redirect; pass the final origin with --app-url)";
  return "";
}
