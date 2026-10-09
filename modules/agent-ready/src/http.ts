// The HTTP shape every discovery document shares: indented JSON, CORS for browser-based agents, and a cache that
// varies with the host, because each document names the host it was asked on.

/** Discovery documents change only with a deploy. */
export const DISCOVERY_CACHE_SECONDS = 3600;
/** Skills and the AI catalog list the introspected tools, which follow the server's configuration. */
export const SHORT_DISCOVERY_CACHE_SECONDS = 300;

/** JSON with two-space indentation: what a person reading the document in a browser expects. */
export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * The headers of a discovery document: its content type, CORS `*` (none of these routes reads a cookie), a public
 * cache, and `vary` on the headers the origins come from.
 */
export function discoveryHeaders(contentType: string, maxAgeSeconds: number = DISCOVERY_CACHE_SECONDS): Record<string, string> {
  return {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "cache-control": `public, max-age=${maxAgeSeconds}`,
    vary: "host, x-forwarded-host, x-forwarded-proto",
  };
}
