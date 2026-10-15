import { z } from "zod";
import { fail } from "../cli/failure.js";

export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

/** Cloudflare's v4 API, reduced to what onboarding needs. Tests pass a fake. */
export interface CloudflareApi {
  /** The `result` of one call; a call Cloudflare answers with `success: false` stops the command. */
  request(method: HttpMethod, path: string, body?: unknown): Promise<unknown>;
}

const envelopeSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).default([]),
  result: z.unknown(),
});

/** The API over `fetch` with a bearer token; the token is never printed. */
export function createCloudflareApi(token: string, fetchFn: typeof fetch = fetch): CloudflareApi {
  return {
    async request(method, path, body) {
      let response: Response;
      try {
        response = await fetchFn(`${CLOUDFLARE_API}${path}`, {
          method,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return fail(`cloudflare: ${method} ${path} failed: ${reason}`);
      }
      const parsed = envelopeSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) return fail(`cloudflare: ${method} ${path} answered ${response.status} without a JSON envelope`);
      if (!parsed.data.success) {
        const reasons = parsed.data.errors.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
        return fail(`cloudflare: ${method} ${path} refused: ${reasons}`);
      }
      return parsed.data.result;
    },
  };
}

/** Narrows a result with a schema; an unexpected shape stops the command. */
export function readResult<T>(schema: z.ZodType<T>, result: unknown, what: string): T {
  const parsed = schema.safeParse(result);
  return parsed.success ? parsed.data : fail(`cloudflare: ${what} answered in an unexpected shape`);
}
