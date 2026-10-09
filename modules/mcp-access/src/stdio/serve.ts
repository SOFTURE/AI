// The app's MCP server over stdio, for a local assistant (Claude Code, Claude Desktop) on the machine
// that holds the database. There is no token: the account comes from the environment or, on a
// database with exactly one account, is that account. The app's factory is the one the endpoint uses.
//
//   // scripts/mcp-stdio.ts, run with `tsx --import @softure-ai/mcp-access/stdio/register scripts/mcp-stdio.ts`
//   const started = await serveMcpStdio({ config, createServer });
//   if (!started.ok) { console.error(started.error.message); process.exitCode = 1; }
import type { Transport } from "@modelcontextprotocol/server";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { users } from "@softure-ai/auth";
import { errorLogLabel, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { openCommandDatabase, type CommandDatabase } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import type { McpServerIdentity } from "../contract.js";
import type { McpServerFactory } from "../server/endpoint.js";
import { getMcpAccessOptions } from "../server/options.js";

/** The variable naming the account to serve, unless the entry is told another one. */
export const DEFAULT_MCP_USER_ID_ENV = "MCP_USER_ID";

/** The token id the factory receives over stdio, where there is no token. */
export const STDIO_TOKEN_ID = "stdio";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type McpStdioErrorCode = "mcp-access.stdio_no_database" | "mcp-access.stdio_no_account" | "mcp-access.stdio_account_ambiguous" | "mcp-access.stdio_account_unknown";

/** Why the entry did not start, with a message for the person running it (stderr: stdout is the protocol). */
export interface McpStdioError {
  readonly code: McpStdioErrorCode;
  readonly message: string;
}

export interface McpStdioHandle {
  /** Who the server runs as. */
  readonly identity: McpServerIdentity;
  /** Ends the connection and closes the database. Also happens when the client closes stdin. */
  readonly close: () => Promise<void>;
}

export type McpStdioResult = { readonly ok: true; readonly value: McpStdioHandle } | { readonly ok: false; readonly error: McpStdioError };

export interface ServeMcpStdioOptions {
  readonly config: SoftureConfig;
  readonly createServer: McpServerFactory;
  /** The environment variable with the account's id. Default: `MCP_USER_ID`. */
  readonly userIdEnv?: string;
  /** Registers write tools, when the app's `allowWrites` is on too. Default: false, read only. */
  readonly allowWrites?: boolean;
  /** Default: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Default: stdin and stdout of this process. */
  readonly transport?: Transport;
  /** Default: the config's `database.handle`, else a connection on `database.url`. */
  readonly openDatabase?: (database: SoftureDatabaseConfig) => Promise<CommandDatabase>;
}

/** Resolves the account, then serves the app's server for it over stdio until the client goes away. */
export async function serveMcpStdio(options: ServeMcpStdioOptions): Promise<McpStdioResult> {
  const { config } = options;
  if (config.database === null) return refuse("mcp-access.stdio_no_database", "softure.config.ts has no database; mcp-access needs one");
  const userIdEnv = options.userIdEnv ?? DEFAULT_MCP_USER_ID_ENV;
  const env = options.env ?? process.env;
  const database = await (options.openDatabase ?? ((settings) => openCommandDatabase(settings, { max: 1 })))(config.database);

  let userId: string | McpStdioError;
  try {
    userId = await resolveAccount(database, env[userIdEnv]?.trim() ?? "", userIdEnv);
  } catch (error) {
    await database.close();
    throw new Error(`@softure-ai/mcp-access: looking up the account to serve failed: ${errorLogLabel(error)}`, { cause: error });
  }
  if (typeof userId !== "string") {
    await database.close();
    return { ok: false, error: userId };
  }

  const identity: McpServerIdentity = {
    userId,
    canWrite: (options.allowWrites ?? false) && getMcpAccessOptions(config).allowWrites,
    tokenId: STDIO_TOKEN_ID,
  };
  let closed = false;
  const closeDatabase = async () => {
    if (closed) return;
    closed = true;
    await database.close();
  };
  const transport = options.transport ?? new StdioServerTransport();
  const handle = serveStdio(() => options.createServer(identity), {
    transport,
    onerror: (error) => console.error(`@softure-ai/mcp-access: the stdio connection reported: ${errorLogLabel(error)}`),
  });
  // serveStdio has set its own handler by now; the database follows the connection, so a client that
  // closes stdin leaves no open pool keeping the process alive.
  const servedOnClose = transport.onclose;
  transport.onclose = () => {
    servedOnClose?.();
    void closeDatabase();
  };
  return {
    ok: true,
    value: {
      identity,
      close: async () => {
        await handle.close();
        await closeDatabase();
      },
    },
  };
}

/** The account id, or why there is none. Never the first of several accounts: that could be another person's data. */
async function resolveAccount(database: CommandDatabase, requested: string, userIdEnv: string): Promise<string | McpStdioError> {
  const { db } = database.handle;
  if (requested !== "") {
    const unknown = { code: "mcp-access.stdio_account_unknown", message: `@softure-ai/mcp-access: ${userIdEnv} names no account` } as const;
    if (!UUID_SHAPE.test(requested)) return unknown;
    const found = await db.select({ id: users.id }).from(users).where(eq(users.id, requested)).limit(1);
    return found[0]?.id ?? unknown;
  }
  const accounts = await db.select({ id: users.id }).from(users).limit(2);
  const [only, second] = accounts;
  if (only === undefined) return { code: "mcp-access.stdio_no_account", message: "@softure-ai/mcp-access: the database has no account to serve" };
  if (second !== undefined) {
    return { code: "mcp-access.stdio_account_ambiguous", message: `@softure-ai/mcp-access: the database has several accounts; set ${userIdEnv} to the id of the one to serve` };
  }
  return only.id;
}

function refuse(code: McpStdioErrorCode, reason: string): McpStdioResult {
  return { ok: false, error: { code, message: `@softure-ai/mcp-access: ${reason}` } };
}
