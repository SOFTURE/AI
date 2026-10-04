// Where an auth action redirects. The app's `rewriteRedirect` option may change auth's path (e.g.
// analytics' `tagRedirect` keeps the channel tag), but its result must still be a path on this app,
// and a rewrite that fails never blocks the redirect: auth's own path is used instead.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { toSafeNextPath } from "./safe-next-path.js";
import { getAuthOptions } from "./server/options.js";

/** `path` as the app's `rewriteRedirect` returns it, or `path` itself without one or on failure. */
export async function resolveRedirectTarget(config: SoftureConfig, path: string): Promise<string> {
  const { rewriteRedirect } = getAuthOptions(config);
  if (rewriteRedirect === undefined) return path;
  try {
    return toSafeNextPath(await rewriteRedirect(path, { config }), path);
  } catch (error) {
    console.error(`@softure-ai/auth: rewriting the redirect to ${path} failed: ${errorLogLabel(error)}`);
    return path;
  }
}
