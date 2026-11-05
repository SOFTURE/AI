// Opt-in request diagnostics for the MCP endpoint (#1066). A hosted client can keep a stale tool list although the
// server serves the current one, and nothing showed what the client actually sends. One entry per request says which
// JSON-RPC method came, in which session state, with which answer. No token, body, argument value, session id or
// user identity is ever part of an entry; client-supplied strings are cut and stripped of control characters.
import { errorLogLabel } from "@softure-ai/core";

/** How a request's `Mcp-Session-Id` relates to the tool list version (#1055). */
export type McpSessionState =
  /** No session id came with the request. */
  | "none"
  /** The session carries the current version and was served. */
  | "current"
  /** The session carries another version and was answered 404, so the client should initialize again. */
  | "stale"
  /** The session id is not one the endpoint issues; answered 404 like a stale one. */
  | "not_issued"
  /** A session id came, but it was not checked (refused before authentication, or no version to check against). */
  | "unchecked";

/** One request as the diagnostics see it. */
export interface McpRequestDiagnostic {
  /** The HTTP method. */
  readonly httpMethod: string;
  /** The JSON-RPC method, `"batch"` for an array, `null` when the body was not read or is not JSON-RPC. */
  readonly method: string | null;
  /** The tool name of a `tools/call`, otherwise `null`. */
  readonly tool: string | null;
  readonly session: McpSessionState;
  /** The version a stale session carries, otherwise `null`. */
  readonly sessionVersion: string | null;
  /** The tool list version served to the identity, `null` when unknown (refused before authentication, no reader). */
  readonly toolListVersion: string | null;
  /** Whether the answer issued a new session id (a successful `initialize`). */
  readonly sessionIssued: boolean;
  /** The HTTP status of the answer. */
  readonly status: number;
  /** The client's `clientInfo` on `initialize`, otherwise `null`. */
  readonly client: { readonly name: string; readonly version: string } | null;
  /** The protocol version the client asked for on `initialize`, otherwise the `MCP-Protocol-Version` header, or `null`. */
  readonly protocolVersion: string | null;
}

/** `true` logs one `console.info` line per request; a function receives each entry instead. */
export type McpRequestDiagnostics = boolean | ((entry: McpRequestDiagnostic) => void);

/** What the diagnostics read from a request body. */
export interface JsonRpcSummary {
  readonly method: string | null;
  readonly tool: string | null;
  readonly client: { readonly name: string; readonly version: string } | null;
  readonly protocolVersion: string | null;
}

const MAX_TEXT_LENGTH = 128;
const PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const EMPTY_SUMMARY: JsonRpcSummary = { method: null, tool: null, client: null, protocolVersion: null };

/** Client-supplied text as it may be logged: control characters replaced, at most 128 characters. */
export function sanitizeDiagnosticText(value: string): string {
  const clean = Array.from(value, (character) => (isControlCharacter(character) ? "?" : character)).join("");
  return clean.length > MAX_TEXT_LENGTH ? `${clean.slice(0, MAX_TEXT_LENGTH)}…` : clean;
}

/**
 * The method, tool name, `clientInfo` and protocol version of a request, read from a clone of its body. A body over
 * `maxBytes` or one that is not JSON gives no method (the SDK answers it itself). Nothing else of the body is kept.
 */
export async function readJsonRpcSummary(request: Request, maxBytes: number): Promise<JsonRpcSummary> {
  const header = request.headers.get(PROTOCOL_VERSION_HEADER);
  const headerVersion = header === null ? null : sanitizeDiagnosticText(header);
  const withHeader = { ...EMPTY_SUMMARY, protocolVersion: headerVersion };
  if (request.method !== "POST") return withHeader;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > maxBytes) return withHeader;
  let body: unknown;
  try {
    const text = await request.clone().text();
    if (text.length > maxBytes) return withHeader;
    body = JSON.parse(text);
  } catch {
    // Not JSON or no readable body: the SDK answers that itself; the entry just has no method.
    return withHeader;
  }
  if (Array.isArray(body)) return { ...withHeader, method: "batch" };
  if (!isRecord(body) || typeof body.method !== "string") return withHeader;

  const method = sanitizeDiagnosticText(body.method);
  const params = isRecord(body.params) ? body.params : {};
  if (body.method === "tools/call") {
    return { ...withHeader, method, tool: typeof params.name === "string" ? sanitizeDiagnosticText(params.name) : null };
  }
  if (body.method !== "initialize") return { ...withHeader, method };
  const clientInfo = isRecord(params.clientInfo) ? params.clientInfo : null;
  const client =
    clientInfo === null
      ? null
      : {
          name: typeof clientInfo.name === "string" ? sanitizeDiagnosticText(clientInfo.name) : "",
          version: typeof clientInfo.version === "string" ? sanitizeDiagnosticText(clientInfo.version) : "",
        };
  const protocolVersion = typeof params.protocolVersion === "string" ? sanitizeDiagnosticText(params.protocolVersion) : headerVersion;
  return { method, tool: null, client, protocolVersion };
}

/** The sink for the option, or `undefined` when diagnostics are off. A throwing sink is logged, never rethrown. */
export function createDiagnosticsSink(diagnostics: McpRequestDiagnostics | undefined): ((entry: McpRequestDiagnostic) => void) | undefined {
  if (diagnostics === undefined || diagnostics === false) return undefined;
  const write = diagnostics === true ? logDiagnostic : diagnostics;
  return (entry) => {
    try {
      write(entry);
    } catch (error) {
      console.error(`@softure-ai/mcp-access: the request diagnostics sink failed: ${errorLogLabel(error)}`);
    }
  };
}

function logDiagnostic(entry: McpRequestDiagnostic): void {
  console.info(`@softure-ai/mcp-access: mcp request ${JSON.stringify(entry)}`);
}

/** C0 controls, DEL and C1 controls: anything that could break or forge a log line. */
function isControlCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
