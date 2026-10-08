// The AI catalog at `/.well-known/ai-catalog.json` (Agentic Resource Discovery, ai-catalog 1.0). It points at the
// documents that already answer from outside (server card, A2A card, API catalog, skills) and never copies them, so
// each keeps one source of truth. On top of the spec, scanners require `host.identifier` and 2 to 5
// `representativeQueries` per entry.
import type { AgentSkill } from "./agent-skills.js";
import { MCP_SERVER_CARD_MEDIA_TYPE } from "./api-catalog.js";
import { getMcpServerTitle, getServiceDocUrl, type AgentDocumentContext } from "./context.js";
import { A2A_AGENT_CARD_PATH, AI_CATALOG_PATH, API_CATALOG_PATH, MCP_SERVER_CARD_PATH, skillPath } from "./paths.js";

export const AI_CATALOG_SPEC_VERSION = "1.0";

/** The ids `catalog.queries` keys its fixed entries by; a skill's entry is keyed by the skill's name. */
export const CATALOG_ENTRY_IDS = { mcp: "mcp", a2a: "a2a", apiCatalog: "api-catalog" } as const;

export interface AiCatalogEntry {
  readonly identifier: string;
  readonly displayName: string;
  readonly type: string;
  readonly url: string;
  readonly description: string;
  readonly representativeQueries: readonly string[];
}

export interface AiCatalog {
  readonly specVersion: string;
  readonly host: { readonly displayName: string; readonly identifier: string; readonly documentationUrl: string };
  readonly entries: readonly AiCatalogEntry[];
}

/** `urn:air:<publisher>:<namespace>:<name>`: the publisher is the apex's host name. */
export function buildAirIdentifier(publisher: string, namespace: string, name: string): string {
  return `urn:air:${publisher}:${namespace}:${name}`;
}

/** The card name's last segment, the stable name of the app's own entries. */
function getEntryName(cardName: string): string {
  return (cardName.split("/").at(-1) ?? cardName).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

/**
 * The catalog. Queries come from `catalog.queries[<entry id>]`; an entry without its own get two built from the
 * title and its description (the scanner's minimum). The host's identifier is the apex domain, not a `did:web`: a DID
 * without `/.well-known/did.json` would not resolve.
 */
export function buildAiCatalog(context: AgentDocumentContext, skills: readonly AgentSkill[]): AiCatalog {
  const { options, origins } = context;
  const apex = origins.apexOrigin;
  const publisher = new URL(apex).hostname;
  const name = getEntryName(options.name);
  const queries = options.catalog.queries;
  const pick = (id: string, fallback: readonly string[]) => queries[id] ?? fallback;

  const entries: AiCatalogEntry[] = [
    {
      identifier: buildAirIdentifier(publisher, "mcp", name),
      displayName: getMcpServerTitle(context),
      type: MCP_SERVER_CARD_MEDIA_TYPE,
      url: `${apex}${MCP_SERVER_CARD_PATH}`,
      description: `${options.description} Access with an account token (OAuth 2.1 or a bearer token).`,
      representativeQueries: pick(CATALOG_ENTRY_IDS.mcp, [`${options.title} MCP server`, `connect an AI assistant to ${options.title}`]),
    },
    ...(options.a2a.enabled
      ? [
          {
            identifier: buildAirIdentifier(publisher, "a2a", name),
            displayName: `${options.title} A2A agent card (MCP binding)`,
            type: "application/a2a-agent-card+json",
            url: `${apex}${A2A_AGENT_CARD_PATH}`,
            description: "An agent card for A2A clients. Its only interface is the MCP server (MCP binding), not A2A messages.",
            representativeQueries: pick(CATALOG_ENTRY_IDS.a2a, [`${options.title} agent card`, `${options.title} agent`]),
          },
        ]
      : []),
    {
      identifier: buildAirIdentifier(publisher, "api", "catalog"),
      displayName: `${options.title} API catalog (RFC 9727)`,
      type: "application/linkset+json",
      url: `${apex}${API_CATALOG_PATH}`,
      description: "A linkset with the service's API (the MCP server), its OpenAPI description and its documentation.",
      representativeQueries: pick(CATALOG_ENTRY_IDS.apiCatalog, [`${options.title} API`, `${options.title} OpenAPI`]),
    },
    ...skills.map((skill) => ({
      identifier: buildAirIdentifier(publisher, "skill", skill.name),
      displayName: `Skill: ${skill.name}`,
      type: "application/agent-skills+md",
      url: `${apex}${skillPath(skill.name)}`,
      description: skill.description,
      representativeQueries: pick(skill.name, [skill.description.slice(0, 200), `${options.title} skill ${skill.name}`]),
    })),
  ];

  return {
    specVersion: AI_CATALOG_SPEC_VERSION,
    host: { displayName: options.title, identifier: publisher, documentationUrl: getServiceDocUrl(context) },
    entries,
  };
}

/** The `Agentmap:` line for robots.txt (seo's `robots.other`): `{ Agentmap: "<apex>/.well-known/ai-catalog.json" }`. */
export function buildAgentmapDirective(apexOrigin: string): { readonly Agentmap: string } {
  return { Agentmap: `${new URL(apexOrigin).origin}${AI_CATALOG_PATH}` };
}

/**
 * The `<link>` for the head of the home page, next to the `Link` header and robots.txt's `Agentmap`, e.g. in Next
 * metadata: `other: {}` cannot carry it, so render `<link rel={link.rel} href={link.href} type={link.type} />`.
 * Relative, so it is true on every host.
 */
export function buildAiCatalogLink(): { readonly rel: "ai-catalog"; readonly href: string; readonly type: "application/json" } {
  return { rel: "ai-catalog", href: AI_CATALOG_PATH, type: "application/json" };
}
