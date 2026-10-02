// Route handlers. Mount with a rename, so later handlers of the module fit next to it:
// `export { getSessionRoute as GET } from "@softure-ai/auth/next"` in app/api/auth/session/route.ts.
import { errorLogLabel, safeError } from "@softure-ai/core";
import { getCurrentUser } from "./current-user.js";

const NO_STORE = { "cache-control": "no-store" };

/** `{ user: { id, email } | null }` for the request's session. Never cached. */
export async function getSessionRoute(): Promise<Response> {
  try {
    const user = await getCurrentUser();
    return Response.json({ user: user === null ? null : { id: user.id, email: user.email } }, { headers: NO_STORE });
  } catch (error) {
    console.error(`@softure-ai/auth: session lookup failed: ${errorLogLabel(error)}`);
    return Response.json({ error: safeError(error).error }, { status: 500, headers: NO_STORE });
  }
}
