// The API catalog (RFC 9727, a linkset of RFC 9264 in the shape of Appendix A.2): one `item` per API, here the MCP
// endpoint, and next to it its machine description (`service-desc`) and its page for people (`service-doc`).
import { getMcpEndpointUrl, getMcpServerTitle, getServiceDocTitle, getServiceDocUrl, type AgentDocumentContext } from "./context.js";
import { API_CATALOG_PATH, MCP_SERVER_CARD_PATH, OPENAPI_PATH } from "./paths.js";

/** RFC 9727 §4.2 and §7.3: the catalog's media type with its profile. */
export const API_CATALOG_CONTENT_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

/** SEP-2127: the server card's media type in catalogs. */
export const MCP_SERVER_CARD_MEDIA_TYPE = "application/mcp-server-card+json";

export interface LinkTarget {
  readonly href: string;
  readonly type?: string;
  readonly title?: string;
}

export interface ApiCatalog {
  readonly linkset: ReadonlyArray<{ readonly anchor: string } & Readonly<Record<string, readonly LinkTarget[] | string>>>;
}

/**
 * The catalog: its own anchor on the apex lists the MCP endpoint, whose anchor carries the OpenAPI description and the
 * server card (`service-desc`), the page for people (`service-doc`) and, only when the app opts in, `status`. A
 * catalog lists only what answers from outside: a `status` link to a closed health route would send agents to a 404.
 */
export function buildApiCatalog(context: AgentDocumentContext): ApiCatalog {
  const { apexOrigin, appOrigin } = context.origins;
  const mcp = getMcpEndpointUrl(context);
  const statusPath = context.options.apiCatalog.statusPath;
  return {
    linkset: [
      { anchor: `${apexOrigin}${API_CATALOG_PATH}`, item: [{ href: mcp, title: getMcpServerTitle(context) }] },
      {
        anchor: mcp,
        "service-desc": [
          { href: `${apexOrigin}${OPENAPI_PATH}`, type: "application/openapi+json" },
          { href: `${apexOrigin}${MCP_SERVER_CARD_PATH}`, type: MCP_SERVER_CARD_MEDIA_TYPE },
        ],
        "service-doc": [{ href: getServiceDocUrl(context), type: "text/html", title: getServiceDocTitle(context) }],
        ...(statusPath === undefined ? {} : { status: [{ href: `${appOrigin}${statusPath}`, type: "application/json" }] }),
      },
    ],
  };
}
