// The `Link` header of the home page (RFC 8288): an agent that starts with `GET /` finds the machine documents
// without parsing HTML. No imports outside this file: `next.config.ts` reads it before path aliases exist.

export interface HomeLink {
  readonly href: string;
  readonly rel: string;
  readonly type: string;
}

export interface HomeLinkOptions {
  /** The page for people about the assistant (`serviceDoc.path`). Default `/`. */
  readonly serviceDocPath?: string;
  /** Whether `/` answers `Accept: text/markdown`: adds `describedby`. */
  readonly markdown?: boolean;
}

/**
 * The home page links, as **relative** URLs: RFC 8288 §3.1 resolves them against the request URL, so one header is
 * true on the apex, on the app host and locally, and build time needs no host.
 */
export function getHomeLinks(options: HomeLinkOptions = {}): HomeLink[] {
  const links: HomeLink[] = [
    { href: "/.well-known/api-catalog", rel: "api-catalog", type: "application/linkset+json" },
    { href: "/openapi.json", rel: "service-desc", type: "application/openapi+json" },
    { href: options.serviceDocPath ?? "/", rel: "service-doc", type: "text/html" },
  ];
  if (options.markdown === true) links.push({ href: "/", rel: "describedby", type: "text/markdown" });
  return links;
}

/** One header value, entries separated by commas (RFC 8288 §3). */
export function buildHomeLinkHeader(options: HomeLinkOptions = {}): string {
  return getHomeLinks(options)
    .map(({ href, rel, type }) => `<${href}>; rel="${rel}"; type="${type}"`)
    .join(", ");
}

/**
 * One entry of `headers()` in `next.config.ts`: a structural copy of Next's `Header`, so this file imports nothing
 * from Next. Mutable like Next's own type, so the entries are assignable to `NextConfig["headers"]` as they are.
 */
export interface NextHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * The `headers()` entries for `next.config.ts`: the home page's `Link` header, e.g.
 * `async headers() { return [...nextHeaders({ markdown: true })]; }`.
 */
export function nextHeaders(options: HomeLinkOptions = {}): NextHeaderRule[] {
  return [{ source: "/", headers: [{ key: "Link", value: buildHomeLinkHeader(options) }] }];
}
