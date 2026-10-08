// The export route handler. Mount with a rename:
// `export { exportRoute as GET } from "@softure-ai/privacy/next"` in app/api/privacy/export/route.ts.
// The user comes from the session cookie only; the answer is a JSON attachment that is never cached.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, safeError, toCalendarDay, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getPrivacyOptions } from "../server/options.js";
import { exportOwnData } from "../server/self-service.js";
import { getPrivacyContext } from "./context.js";

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function fail(error: string, status: number, headers: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers: { ...NO_STORE, ...headers } });
}

/** `account-data-2026-10-03.json`: the date of the download in the app's time zone. */
export function getFileName(config: SoftureConfig, now: Date): string {
  return `${getPrivacyOptions(config).export.fileName}-${toCalendarDay(now, config.timezone)}.json`;
}

/**
 * The signed-in user's data as a JSON download. 401 without a session, 429 with `retry-after` over
 * the `privacy-export` limit, 413 over `export.maxBytes`, 500 when a contributor fails.
 */
export async function exportRoute(): Promise<Response> {
  try {
    const config = getSoftureConfig();
    const user = await getCurrentUser();
    if (user === null) return fail("auth.unauthenticated", 401);

    const ctx = await getPrivacyContext(config);
    const result = await exportOwnData(ctx, { userId: user.id });
    if (!result.ok) {
      if ("retryAfterSeconds" in result) return fail(result.error, 429, { "retry-after": String(result.retryAfterSeconds) });
      return fail(result.error, result.error === "privacy.export_too_large" ? 413 : 500);
    }
    return new Response(result.value.json, {
      headers: {
        ...NO_STORE,
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${getFileName(config, ctx.clock.now())}"`,
      },
    });
  } catch (error) {
    console.error(`@softure-ai/privacy: export failed: ${errorLogLabel(error)}`);
    return fail(safeError(error).error, 500);
  }
}
