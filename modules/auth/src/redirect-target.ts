// Where auth redirects, from an action or from a page's render. The app's `rewriteRedirect` option
// may change auth's path (e.g. analytics' `tagRedirect` keeps the channel tag), but its result must
// still be a path on this app, and a rewrite that fails never blocks the redirect: auth's own path
// is used instead.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import type { RewriteRedirectContext } from "./options.js";
import { toSafeNextPath } from "./safe-next-path.js";
import { getAuthOptions } from "./server/options.js";

/**
 * `path` as the app's `rewriteRedirect` returns it, or `path` itself without one or on failure.
 * A page passes its own `searchParams`; an action passes none.
 */
export async function resolveRedirectTarget(config: SoftureConfig, path: string, searchParams?: URLSearchParams): Promise<string> {
  const { rewriteRedirect } = getAuthOptions(config);
  if (rewriteRedirect === undefined) return path;
  const ctx: RewriteRedirectContext = searchParams === undefined ? { config } : { config, searchParams };
  try {
    return toSafeNextPath(await rewriteRedirect(path, ctx), path);
  } catch (error) {
    console.error(`@softure-ai/auth: rewriting the redirect to ${path} failed: ${errorLogLabel(error)}`);
    return path;
  }
}
