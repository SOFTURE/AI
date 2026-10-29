import { buildInfoSchema, type SmokeBuildInfo } from "./smoke-checks.js";

export type FetchBuildInfoResult = { ok: true; info: SmokeBuildInfo } | { ok: false; reason: string };

export interface FetchBuildInfoOptions {
  url: string;
  headers?: Readonly<Record<string, string>>;
  timeoutMs: number;
  fetch?: typeof fetch;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return "no answer in time";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  return cause instanceof Error ? cause.message : String(cause);
}

/** One GET of the build info route; a redirect is not followed (an access proxy's sign-in is not the app). */
export async function fetchBuildInfo(options: FetchBuildInfoOptions): Promise<FetchBuildInfoResult> {
  const fetchFunction = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchFunction(options.url, {
      headers: { accept: "application/json", "cache-control": "no-cache", ...options.headers },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    return { ok: false, reason: `the request failed: ${describeError(error)}` };
  }
  if (response.status !== 200) {
    await response.body?.cancel();
    return { ok: false, reason: `it answered ${response.status}, not 200` };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "it answered something other than JSON" };
  }
  const parsed = buildInfoSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, reason: "its JSON is not build info (release, commit and startedAt)" };
  }
  return { ok: true, info: parsed.data };
}
