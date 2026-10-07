// The options an app passes to `mcpAccess({ ... })` in softure.config.ts, parsed at startup.
import { LOCALES } from "@softure-ai/core";
import { z } from "zod";

/** The name an MCP client lists the server under: no spaces, so a shell command needs no quotes. */
export const SERVER_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** The MCP rule for tool names: 1 to 128 of A-Z, a-z, 0-9, `_`, `-` and `.`. */
export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/** The longest token name the table takes (`access_tokens.name`). */
export const MAX_TOKEN_NAME_LENGTH = 60;

/** The longest value the token check looks at: a longer header is refused before any pattern runs. */
export const MAX_PRESENTED_TOKEN_LENGTH = 512;

/** Copy per locale; a locale without its own text falls back to `en`. */
const localizedTextSchema = z.partialRecord(z.enum(LOCALES), z.string().trim().min(1).max(500));

const toolSchema = z.strictObject({
  /** The tool's name as the app's MCP server registers it. */
  name: z.string().regex(TOOL_NAME_PATTERN, "must be 1 to 128 of A-Z, a-z, 0-9, _, - and ."),
  /**
   * `write` tools change data: the app registers them only for a token that can write. They stay
   * listed while `allowWrites` is off, marked as unavailable.
   */
  access: z.enum(["read", "write"]),
  /** What the tool does, for the owner deciding which token to issue. */
  description: localizedTextSchema.refine((text) => text.en !== undefined, "needs at least an en text"),
});

const oauthSchema = z.strictObject({
  /**
   * Makes the module an OAuth 2.1 authorization server for its endpoint: discovery metadata,
   * dynamic client registration, a consent page and a token endpoint. The app mounts those routes.
   */
  enabled: z.boolean().default(false),
  /** How long an access token issued through OAuth works. Clients refresh it themselves. */
  accessTokenLifetimeMinutes: z.int().min(5).max(1440).default(60),
  /** How long a refresh token works, counted from the last refresh: a grant in use never expires. */
  refreshTokenLifetimeDays: z.int().min(1).max(365).default(90),
  /** How long an authorization code works; RFC 6749 §4.1.2 recommends at most ten minutes. */
  authorizationCodeLifetimeMinutes: z.int().min(1).max(10).default(10),
});

/** A pattern for tokens an app issued before adopting the module: anchored, and stateless. */
const legacyTokenPatternSchema = z
  .instanceof(RegExp, { message: "must be a RegExp" })
  .refine((pattern) => pattern.source.startsWith("^") && pattern.source.endsWith("$"), "must be anchored with ^ and $")
  .refine((pattern) => !pattern.global && !pattern.sticky, "must not use the g or y flag");

export const mcpAccessOptionsSchema = z
  .strictObject({
    /** The name MCP clients list the server under, e.g. "acme". Used in the setup instructions. */
    serverName: z.string().regex(SERVER_NAME_PATTERN, "must be lowercase letters, digits and inner dashes, at most 64 characters"),
    /** The app's tool catalog, shown on the token page. The MCP server itself comes from the route. */
    tools: z.array(toolSchema).default([]),
    /** Lets write tokens be issued and used. Off, every token reads only, write tokens included. */
    allowWrites: z.boolean().default(false),
    /** How long a token issued on the token page works. A choice: longer than a session, never forever. */
    tokenLifetimeDays: z.int().min(1).max(365).default(90),
    /** How many unexpired tokens one account may hold. */
    maxTokensPerUser: z.int().min(1).max(100).default(20),
    /** From how many calendar days before its expiry the page warns about a token. */
    expiryWarningDays: z.int().min(0).max(60).default(14),
    /**
     * Tokens an app issued before it adopted the module, e.g. `/^[0-9a-f]{64}$/`. Such a value is
     * looked up by its sha256 like a token of the module's own shape; new tokens keep the prefix.
     */
    legacyTokenPattern: legacyTokenPatternSchema.optional(),
    /** OAuth 2.1 for MCP clients that connect without a pasted token (claude.ai, ChatGPT). */
    oauth: oauthSchema.prefault({}),
  })
  .superRefine((options, context) => {
    const names = new Set<string>();
    options.tools.forEach((tool, index) => {
      if (names.has(tool.name)) {
        context.addIssue({ code: "custom", path: ["tools", index, "name"], message: `"${tool.name}" is listed twice` });
      }
      names.add(tool.name);
    });
  });

export type McpAccessOptionsInput = z.input<typeof mcpAccessOptionsSchema>;
export type McpAccessOptions = z.output<typeof mcpAccessOptionsSchema>;
export type McpToolDefinitionInput = z.input<typeof toolSchema>;
export type McpToolDefinition = z.output<typeof toolSchema>;
export type McpToolAccess = McpToolDefinition["access"];
export type McpOAuthOptions = z.output<typeof oauthSchema>;
