// Sessions tied to the tool list version (#1055). A hosted client keeps its cached `tools/list` for as long as its
// connection lives, even after a release changed a tool, and the endpoint has no channel to send
// `notifications/tools/list_changed`. So the endpoint answers `initialize` with an `Mcp-Session-Id` that carries the
// tool list version of the identity's access level, and a later request whose session carries another version gets
// `404 Not Found`: Streamable HTTP defines that as "start a new session", so the client initializes again and lists
// the tools again. Nothing is stored: the id itself holds the version, so any instance can check it.
import { randomBytes } from "node:crypto";

/** The header that carries the session id, both ways. */
export const MCP_SESSION_ID_HEADER = "mcp-session-id";

/** Random bytes after the version, as hex. */
const RANDOM_BYTES = 16;
const SESSION_ID_PATTERN = /^([A-Za-z0-9_-]+)\.[0-9a-f]+$/;
const SSE_DATA_PREFIX = "data: ";

/** A new session id for the version: `<base64url(version)>.<32 hex>`, visible ASCII whatever the version holds. */
export function createToolListSessionId(toolListVersion: string): string {
  return `${Buffer.from(toolListVersion, "utf8").toString("base64url")}.${randomBytes(RANDOM_BYTES).toString("hex")}`;
}

/** The tool list version a session id carries, or `null` when the id is not one the endpoint issues. */
export function readToolListSessionVersion(sessionId: string): string | null {
  const match = SESSION_ID_PATTERN.exec(sessionId);
  if (match?.[1] === undefined) return null;
  return Buffer.from(match[1], "base64url").toString("utf8");
}

/** Whether a request in this session may be served: its version is the current one. */
export function isToolListSessionCurrent(sessionId: string, toolListVersion: string): boolean {
  return readToolListSessionVersion(sessionId) === toolListVersion;
}

/** The answer to a request in a session from another tool list version: the client starts a new session. */
export function createSessionRenewalResponse(): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "Session not found: the tool list changed, initialize again" }, id: null },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Whether the request is a JSON-RPC `initialize`: a POST without a session id whose JSON body asks for it. The body
 * is read from a clone, and a body over `maxBytes` is not read (the SDK refuses it with 413 anyway).
 */
export async function isInitializeRequest(request: Request, maxBytes: number): Promise<boolean> {
  if (request.method !== "POST" || request.headers.has(MCP_SESSION_ID_HEADER)) return false;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > maxBytes) return false;
  let body: unknown;
  try {
    const text = await request.clone().text();
    if (text.length > maxBytes) return false;
    body = JSON.parse(text);
  } catch {
    // Not JSON: the SDK answers the parse error itself.
    return false;
  }
  return typeof body === "object" && body !== null && !Array.isArray(body) && (body as { method?: unknown }).method === "initialize";
}

/**
 * The `initialize` answer with `capabilities.tools.listChanged: false`, since no answer of the endpoint ever carries
 * the notification, and with the session id when there is one. The body keeps its format (JSON or one SSE event);
 * an answer that is not a successful `InitializeResult` is returned as it is.
 */
export async function rewriteInitializeAnswer(response: Response, sessionId: string | null): Promise<Response> {
  if (response.status !== 200) return response;
  const text = await response.text();
  const isEventStream = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  const lines = text.split("\n");
  const dataIndex = isEventStream ? lines.findIndex((line) => line.startsWith(SSE_DATA_PREFIX)) : -1;
  const json = isEventStream ? (dataIndex === -1 ? null : (lines[dataIndex] ?? "").slice(SSE_DATA_PREFIX.length)) : text;

  const answer = parseInitializeAnswer(json);
  const headers = new Headers(response.headers);
  // The body changes length, so the old one would be wrong.
  headers.delete("content-length");
  const tools = answer?.result?.capabilities?.tools;
  if (answer === null || answer.result?.protocolVersion === undefined) {
    return new Response(text, { status: response.status, statusText: response.statusText, headers });
  }
  if (tools !== undefined && tools !== null && typeof tools === "object") tools.listChanged = false;
  if (sessionId !== null) headers.set(MCP_SESSION_ID_HEADER, sessionId);

  const rewritten = JSON.stringify(answer);
  if (isEventStream) lines[dataIndex] = `${SSE_DATA_PREFIX}${rewritten}`;
  return new Response(isEventStream ? lines.join("\n") : rewritten, { status: response.status, statusText: response.statusText, headers });
}

/** The answer as JSON, or `null` when there is none or it is not JSON (the SDK's own error text). */
function parseInitializeAnswer(json: string | null): InitializeAnswer | null {
  if (json === null) return null;
  try {
    return JSON.parse(json) as InitializeAnswer;
  } catch {
    return null;
  }
}

interface InitializeAnswer {
  result?: { protocolVersion?: unknown; capabilities?: { tools?: { listChanged?: boolean } | null } };
}
