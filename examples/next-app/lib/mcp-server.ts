// The example's MCP server, built per request by POST /api/mcp (@softure-ai/mcp-access) with the
// identity of the token that called. Read tools for every token; the write tool only when the
// token may write (the app's allowWrites and a write token). The catalog in softure.config.ts
// lists the same tools for the token page; e2e/mcp-access.spec.ts compares the two.
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import { z } from "zod";
import { GUESTBOOK_MESSAGE_MAX_LENGTH } from "../modules/guestbook/limits.ts";
import { findEntries, insertEntry } from "../modules/guestbook/queries.ts";
import { getDatabase } from "./database.ts";

function answer(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function failure(code: string): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: code }) }], isError: true };
}

export function createServer({ userId, canWrite }: McpServerIdentity): McpServer {
  const server = new McpServer({ name: "softure-example", version: "0.0.0" });

  server.registerTool("whoami", { description: "The account this token belongs to and whether it may write." }, () => answer({ userId, canWrite }));

  server.registerTool("list_entries", { description: "The newest guestbook entries." }, async () => {
    const { db } = await getDatabase();
    const entries = await findEntries(db);
    return entries.ok ? answer(entries.value.map((entry) => entry.message)) : failure(entries.error);
  });

  if (canWrite) {
    server.registerTool(
      "sign_guestbook",
      {
        description: "Adds an entry to the guestbook.",
        inputSchema: z.object({ message: z.string().trim().min(1).max(GUESTBOOK_MESSAGE_MAX_LENGTH) }),
      },
      async ({ message }) => {
        const { db } = await getDatabase();
        const result = await insertEntry(db, message);
        return result.ok ? answer({ signed: message }) : failure(result.error);
      },
    );
  }

  return server;
}
