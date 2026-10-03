// The options an app passes to `mcpAccess({ ... })` in softure.config.ts, parsed at startup.
import { LOCALES } from "@softure-ai/core";
import { z } from "zod";

/** The name an MCP client lists the server under: no spaces, so a shell command needs no quotes. */
export const SERVER_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** The MCP rule for tool names: 1 to 128 of A-Z, a-z, 0-9, `_`, `-` and `.`. */
export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/** The longest token name the table takes (`access_tokens.name`). */
export const MAX_TOKEN_NAME_LENGTH = 60;

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

export const mcpAccessOptionsSchema = z
  .strictObject({
    /** The name MCP clients list the server under, e.g. "acme". Used in the setup instructions. */
    serverName: z.string().regex(SERVER_NAME_PATTERN, "must be lowercase letters, digits and inner dashes, at most 64 characters"),
    /** The app's tool catalog, shown on the token page. The MCP server itself comes from the route. */
    tools: z.array(toolSchema).default([]),
    /** Lets write tokens be issued and used. Off, every token reads only, write tokens included. */
    allowWrites: z.boolean().default(false),
    /** How long a token works. A choice: longer than a session, never forever. */
    tokenLifetimeDays: z.int().min(1).max(365).default(90),
    /** How many unexpired tokens one account may hold. */
    maxTokensPerUser: z.int().min(1).max(100).default(20),
    /** From how many calendar days before its expiry the page warns about a token. */
    expiryWarningDays: z.int().min(0).max(60).default(14),
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
