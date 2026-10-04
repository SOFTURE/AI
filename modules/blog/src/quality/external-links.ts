// External links answer 2xx (FIRE_TRACKER `src/lib/blog/quality/external-links.ts`). Over the network
// only on request (`softure-blog check --external`, the weekly workflow): tests and publishing never
// depend on other people's servers. `fetch` is injected so tests stay offline.
import type { QualityFinding } from "./finding.js";

export type FetchLike = (
  url: string,
  init: { readonly method: string; readonly redirect: "follow"; readonly signal: AbortSignal; readonly headers: Record<string, string> },
) => Promise<{ readonly status: number }>;

/** Some public-sector servers refuse requests that do not introduce themselves. */
const USER_AGENT = "softure-blog-link-check/1.0";
/** Servers without HEAD support answer with these; then the check asks with GET. */
const RETRY_WITH_GET = new Set([400, 403, 404, 405, 501]);
const TIMEOUT_MS = 15_000;

export async function checkExternalUrl(url: string, fetchImpl: FetchLike): Promise<{ ok: boolean; detail: string }> {
  const request = (method: string) => fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": USER_AGENT } });
  try {
    let response = await request("HEAD");
    if (RETRY_WITH_GET.has(response.status)) response = await request("GET");
    return { ok: response.status >= 200 && response.status < 300, detail: `HTTP ${String(response.status)}` };
  } catch (error) {
    // A network failure is the finding itself: its message tells the editor what happened.
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Each address once, at its first line. */
export async function checkExternalLinks(links: readonly { readonly url: string; readonly line: number }[], fetchImpl: FetchLike): Promise<QualityFinding[]> {
  const unique = new Map<string, number>();
  for (const link of links) if (!unique.has(link.url)) unique.set(link.url, link.line);
  const results = await Promise.all([...unique].map(async ([url, line]) => ({ url, line, ...(await checkExternalUrl(url, fetchImpl)) })));
  return results
    .filter((result) => !result.ok)
    .map((result) => ({ rule: "external-link-dead", severity: "error", message: `an external link does not answer 2xx (${result.detail}): ${result.url}`, line: result.line }));
}
