// The options an app passes to `agentReady({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import type { McpListedTool } from "./mcp-description.js";
import type { AgentOrigins, OriginRequest } from "./origins.js";

/** SEP-2127: a reverse-DNS namespace and a name, `com.example/app`. */
export const SERVER_CARD_NAME_PATTERN = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;

/** Agent Skills Discovery v0.2.0: lower-case letters, digits and single hyphens, 1 to 64 characters. */
export const SKILL_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,63}$/;

/** Agent Skills: the longest description a `SKILL.md` frontmatter may carry. */
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

/** The fewest and most representative queries an AI catalog entry carries (a scanner requirement). */
export const MIN_CATALOG_QUERIES = 2;
export const MAX_CATALOG_QUERIES = 5;

/** A DNS label under `_agents.` such as `_mcp`. */
const DNS_LABEL_PATTERN = /^_[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const SCOPE_PATTERN = /^[\x21\x23-\x5b\x5d-\x7e]+$/;

const ORIGIN_HINT = "must be an http(s) origin without a path, e.g. https://example.com";
const PATH_HINT = "must be a path starting with a single /";

/** A bare http(s) origin (no path, query, fragment or credentials). */
export function isBareOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.username === "" && url.password === "" && (url.pathname === "/" || url.pathname === "") && !value.includes("?") && !value.includes("#");
}

const originSchema = z
  .string()
  .refine(isBareOrigin, ORIGIN_HINT)
  .transform((value) => new URL(value).origin);

const pathSchema = z.string().refine((path) => path.startsWith("/") && !path.startsWith("//"), PATH_HINT);

const textSchema = z.string().trim().min(1).max(2000);

function functionSchema<T>(hint: string) {
  return z.custom<T>((value) => typeof value === "function", { error: hint });
}

/** The app origin of one request, or null for the configured one. */
export type AppOriginResolver = (request: OriginRequest) => string | null;

/** The authorization server metadata (RFC 8414) the app's token issuer serves for one request. */
export type AuthorizationServerMetadataProvider = (
  request: OriginRequest,
  origins: AgentOrigins,
) => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>;

/** Builds the app's MCP server for introspection, with an anonymous context: no account, no data. */
export type McpServerFactory = () => unknown;

/** A skill an app publishes; `body` is the Markdown after the frontmatter, for the request's origins. */
export interface AgentSkillInput {
  readonly name: string;
  readonly description: string;
  readonly body: (origins: AgentOrigins) => string;
}

const skillSchema = z.strictObject({
  name: z.string().regex(SKILL_NAME_PATTERN, "must be lower-case letters, digits and single hyphens, at most 64 characters"),
  description: z.string().trim().min(1).max(MAX_SKILL_DESCRIPTION_LENGTH),
  body: functionSchema<(origins: AgentOrigins) => string>("must be a function (origins) => string"),
});

const queriesSchema = z.array(z.string().trim().min(1).max(200)).min(MIN_CATALOG_QUERIES).max(MAX_CATALOG_QUERIES);

const dnsAidRecordSchema = z.strictObject({
  /** The label under `_agents.<domain>`, e.g. `_mcp`. */
  label: z.string().regex(DNS_LABEL_PATTERN, "must be a DNS label starting with _, e.g. _mcp"),
  /** `apex` and `app` take the host of the configured origin; anything else is a host name. */
  target: z.union([z.literal("apex"), z.literal("app"), z.string().regex(HOSTNAME_PATTERN, "must be apex, app or a host name")]),
  /** What the record points at, printed by the check. */
  purpose: z.string().trim().min(1).max(200).optional(),
});

export const agentReadyOptionsSchema = z
  .strictObject({
    /** The host of the MCP endpoint and OAuth. Default: the config's `appOrigin`. */
    appOrigin: originSchema.optional(),
    /** The host of documentation, cards and catalogs, when the app has an apex apart from its app host. Default: the app origin. */
    apexOrigin: originSchema.optional(),
    /**
     * The app origin of one request, or null for the configured one; e.g. `readRequestOrigin` when one image serves
     * several origins. Configure it the same way as `@softure-ai/mcp-access`'s `resolveAppOrigin`.
     */
    resolveAppOrigin: functionSchema<AppOriginResolver>("must be a function (request) => string | null").optional(),
    /** SEP-2127 server card name: reverse-DNS namespace and name, `com.example/app`. */
    name: z.string().regex(SERVER_CARD_NAME_PATTERN, "must be a reverse-DNS namespace and a name, e.g. com.example/app"),
    /** The product's name, as agents show it. */
    title: z.string().trim().min(1).max(100),
    /** One or two sentences on what an agent can do with the app. */
    description: textSchema,
    provider: z.strictObject({ organization: z.string().trim().min(1).max(200) }),
    mcp: z.strictObject({
      /** The MCP endpoint's path on the app host. */
      path: pathSchema.default("/api/mcp"),
      /** The app's MCP server with an anonymous context, for `initialize` and `tools/list`. Async imports are welcome. */
      server: functionSchema<McpServerFactory>("must be a function () => McpServer | Promise<McpServer>"),
      /** The protocol versions the endpoint accepts; default: the SDK's `SUPPORTED_PROTOCOL_VERSIONS`. */
      protocolVersions: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date version such as 2025-06-18")).min(1).optional(),
    }),
    /** The scopes the endpoint checks: every token reads, a token that may write carries the write scope. */
    scopes: z
      .strictObject({
        read: z.string().regex(SCOPE_PATTERN).default("mcp:read"),
        write: z.string().regex(SCOPE_PATTERN).default("mcp:write"),
      })
      .prefault({}),
    /** OAuth for the MCP endpoint. Without it, auth.md answers 404 and the documents name the bearer token only. */
    oauth: z
      .strictObject({
        /** The authorization server metadata the token issuer serves; auth.md is built from it. */
        authorizationServerMetadata: functionSchema<AuthorizationServerMetadataProvider>(
          "must be a function (request, origins) => metadata",
        ),
        /** Where a person creates a manual token on the app host, if the app offers one. */
        manualTokenPath: pathSchema.optional(),
        /** Lifetimes auth.md states; leave them out and it points at `expires_in` instead. */
        lifetimes: z
          .strictObject({
            authorizationCodeMinutes: z.int().min(1).max(60),
            accessTokenMinutes: z.int().min(1).max(1440 * 7),
            refreshTokenDays: z.int().min(1).max(3650),
          })
          .optional(),
      })
      .optional(),
    /** The page for people about connecting an assistant, on the apex. */
    serviceDoc: z
      .strictObject({
        path: pathSchema.default("/"),
        title: z.string().trim().min(1).max(200).optional(),
      })
      .prefault({}),
    openapi: z
      .strictObject({
        /** Bump it when the endpoint's contract changes. */
        version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be a version such as 1.0.0").default("1.0.0"),
        title: z.string().trim().min(1).max(200).optional(),
        description: textSchema.optional(),
      })
      .prefault({}),
    apiCatalog: z
      .strictObject({
        /** A public health path to list as the `status` relation; leave it out when the path is not reachable from outside. */
        statusPath: pathSchema.optional(),
      })
      .prefault({}),
    /** Skills the app publishes under `/.well-known/agent-skills/`. */
    skills: z.array(skillSchema).max(50).default([]),
    /** The generated skill that tells an agent how to connect to the MCP server; `false` leaves it out. */
    mcpSkill: z
      .union([
        z.literal(false),
        z.strictObject({
          name: z.string().regex(SKILL_NAME_PATTERN).optional(),
          description: z.string().trim().min(1).max(MAX_SKILL_DESCRIPTION_LENGTH).optional(),
        }),
      ])
      .default({}),
    catalog: z
      .strictObject({
        /** Representative queries per AI catalog entry: `mcp`, `a2a`, `api-catalog` or a skill name; 2 to 5 each. */
        queries: z.record(z.string(), queriesSchema).default({}),
      })
      .prefault({}),
    a2a: z
      .strictObject({
        enabled: z.boolean().default(true),
        /** Tags of one skill (tool) on top of `read` or `write`. */
        skillTags: functionSchema<(tool: McpListedTool) => readonly string[]>("must be a function (tool) => string[]").optional(),
      })
      .prefault({}),
    webBotAuth: z
      .strictObject({
        /** The variable holding the Ed25519 seed (base64url JWK `d`). */
        privateKeyEnv: z.string().regex(ENV_NAME_PATTERN).default("WEB_BOT_AUTH_PRIVATE_KEY"),
        /** The variable listing retired public keys (`x`), comma-separated: published, never used to sign. */
        retiredKeysEnv: z.string().regex(ENV_NAME_PATTERN).default("WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS"),
      })
      .prefault({}),
    dnsAid: z
      .strictObject({
        /** The zone the records live under; default: the apex host. */
        domain: z.string().regex(HOSTNAME_PATTERN, "must be a host name").optional(),
        records: z
          .array(dnsAidRecordSchema)
          .min(1)
          .default([
            { label: "_index", target: "apex", purpose: "service index: the API catalog on the apex" },
            { label: "_mcp", target: "app", purpose: "the MCP server" },
          ]),
      })
      .prefault({}),
    /** Whether `/` answers `Accept: text/markdown` (e.g. through seo); adds the `describedby` link. */
    markdown: z.boolean().default(false),
  })
  .superRefine((options, context) => {
    const names = options.skills.map((skill) => skill.name);
    const mcpSkillName = options.mcpSkill === false ? null : (options.mcpSkill.name ?? getDefaultMcpSkillName(options.name));
    if (mcpSkillName !== null) names.push(mcpSkillName);
    const duplicates = new Set(names.filter((name, index) => names.indexOf(name) !== index));
    for (const name of duplicates) context.addIssue({ code: "custom", path: ["skills"], message: `skill "${name}" is listed twice` });
    if (mcpSkillName !== null && !SKILL_NAME_PATTERN.test(mcpSkillName)) {
      context.addIssue({ code: "custom", path: ["mcpSkill"], message: `the generated skill name "${mcpSkillName}" is not valid; set mcpSkill.name` });
    }
    const entryIds = new Set<string>(["mcp", "a2a", "api-catalog", ...names]);
    for (const id of Object.keys(options.catalog.queries).filter((key) => !entryIds.has(key))) {
      context.addIssue({ code: "custom", path: ["catalog", "queries", id], message: "is not an AI catalog entry: mcp, a2a, api-catalog or a skill name" });
    }
    const labels = options.dnsAid.records.map((record) => record.label);
    for (const label of new Set(labels.filter((label, index) => labels.indexOf(label) !== index))) {
      context.addIssue({ code: "custom", path: ["dnsAid", "records"], message: `label "${label}" is listed twice` });
    }
  });

export type AgentReadyOptions = z.output<typeof agentReadyOptionsSchema>;
export type AgentReadyOptionsInput = z.input<typeof agentReadyOptionsSchema>;

/** The generated MCP skill's name: the last segment of the card name, lower-cased, plus `-mcp`. */
export function getDefaultMcpSkillName(cardName: string): string {
  const base = (cardName.split("/").at(-1) ?? cardName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${base || "app"}-mcp`;
}
