// Tool results for the app's MCP server and the boundary that keeps failures safe: the assistant gets
// a value, a `PublicError`'s message or a hint, never a thrown error's text (a failed query carries
// its SQL and parameters). The log gets the error's kind only (`errorLogLabel`). An optional hook sees
// each call as a whole: which tool, which client, the outcome with its code, and how long it took.
import { isCallToolResult, type CallToolResult } from "@modelcontextprotocol/server";
import { errorLogLabel, getPublicMessage, safeError, type CoreErrorCode } from "@softure-ai/core";

/** What the assistant reads for an error code: the app's own text per code, e.g. `{ "orders.not_found": "No order with that number." }`. */
export type ToolErrorHints = Readonly<Record<string, string>>;

export interface ToolErrorOptions {
  /** Texts per error code; a code without one is answered as the code itself. */
  readonly hints?: ToolErrorHints;
  /** The tool's name in the log line and in the `onToolCall` record. */
  readonly label?: string;
  /** Called once after each call with its record. Its failure is logged by kind and never changes the answer. */
  readonly onToolCall?: ToolCallHook;
  /** Who called, for the record: built once per request in the app's server factory. */
  readonly caller?: ToolCaller;
  /** The tool's arguments, for the record: only their names are read, never their values. */
  readonly args?: Readonly<Record<string, unknown>>;
}

/** The client behind a call: the token's id (`McpServerIdentity.tokenId`) and its name (`findTokenClientName`). */
export interface ToolCaller {
  readonly tokenId: string;
  readonly clientName: string | null;
}

/**
 * How a call ended. `succeeded`: `itemCount` is the length of an array value, else `null`. `failed`: the
 * result's error code, `null` for a `CallToolResult` the tool marked `isError` itself. `thrown`: the
 * `safeError` code, `null` for a `PublicError` (a deliberate message, no code).
 */
export type ToolCallOutcome =
  | { readonly kind: "succeeded"; readonly itemCount: number | null }
  | { readonly kind: "failed"; readonly code: string | null }
  | { readonly kind: "thrown"; readonly code: CoreErrorCode | null };

/** One tool call as the `onToolCall` hook sees it. */
export interface ToolCallRecord {
  /** The tool's `label`, else `"call"`. */
  readonly tool: string;
  readonly tokenId: string | null;
  readonly clientName: string | null;
  readonly argumentNames: readonly string[];
  readonly outcome: ToolCallOutcome;
  readonly startedAt: Date;
  readonly durationMs: number;
}

export type ToolCallHook = (record: ToolCallRecord) => unknown;

/** For failures the tool did not expect: what `safeError` makes of them, unless a hint replaces it. */
const DEFAULT_FAILURE_TEXT: ToolErrorHints = {
  "core.database_failed": "The database could not answer; try again later.",
  "core.unexpected": "The tool failed; try again later.",
};

/** A successful tool answer: a string as text, anything else as JSON text. */
export function toolResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) ?? "null" }] };
}

/** A failed tool answer the assistant reads and may act on. */
export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Runs a tool's work and answers it safely. A `CallToolResult` passes as is; a result value is unwrapped
 * (`{ ok: true, value }` → `toolResult(value)`, `{ ok: false, error }` → `toolError` with the hint for the
 * code, else the code); any other value becomes `toolResult`. A thrown `PublicError` gives its message;
 * anything else is logged by kind and answered with the hint for its `safeError` code, else a fixed text.
 */
export async function withToolErrors(work: () => unknown, options: ToolErrorOptions = {}): Promise<CallToolResult> {
  const startedAt = Date.now();
  let answer: CallToolResult;
  let outcome: ToolCallOutcome;
  try {
    const value = await work();
    answer = answerValue(value, options.hints);
    outcome = describeValueOutcome(value);
  } catch (error) {
    answer = answerFailure(error, options);
    outcome = { kind: "thrown", code: getPublicMessage(error) === null ? safeError(error).error : null };
  }
  if (options.onToolCall !== undefined) await reportToolCall(options, outcome, startedAt);
  return answer;
}

async function reportToolCall(options: ToolErrorOptions, outcome: ToolCallOutcome, startedAt: number): Promise<void> {
  const tool = options.label ?? "call";
  const record: ToolCallRecord = {
    tool,
    tokenId: options.caller?.tokenId ?? null,
    clientName: options.caller?.clientName ?? null,
    argumentNames: Object.keys(options.args ?? {}),
    outcome,
    startedAt: new Date(startedAt),
    durationMs: Date.now() - startedAt,
  };
  try {
    await options.onToolCall?.(record);
  } catch (error) {
    console.error(`@softure-ai/mcp-access: the onToolCall hook failed for tool ${tool}: ${errorLogLabel(error)}`);
  }
}

function describeValueOutcome(value: unknown): ToolCallOutcome {
  if (isCallToolResult(value)) return value.isError === true ? { kind: "failed", code: null } : { kind: "succeeded", itemCount: null };
  if (isResult(value)) return value.ok ? countItems(value.value) : { kind: "failed", code: value.error };
  return countItems(value);
}

function countItems(value: unknown): ToolCallOutcome {
  return { kind: "succeeded", itemCount: Array.isArray(value) ? value.length : null };
}

/** The answer for a value a tool or an action returned. */
export function answerValue(value: unknown, hints: ToolErrorHints = {}): CallToolResult {
  if (isCallToolResult(value)) return value;
  if (isResult(value)) return value.ok ? toolResult(value.value) : toolError(describeCode(value.error, hints));
  return toolResult(value);
}

function answerFailure(error: unknown, options: ToolErrorOptions): CallToolResult {
  const publicMessage = getPublicMessage(error);
  if (publicMessage !== null) return toolError(publicMessage);
  console.error(`@softure-ai/mcp-access: tool ${options.label ?? "call"} failed: ${errorLogLabel(error)}`);
  const code = safeError(error).error;
  return toolError(options.hints?.[code] ?? DEFAULT_FAILURE_TEXT[code] ?? code);
}

/** The text for an error code: the app's hint, else the code. */
export function describeCode(code: string, hints: ToolErrorHints): string {
  return Object.hasOwn(hints, code) ? (hints[code] ?? code) : code;
}

/** Core's result shape: `{ ok: true, value }` or `{ ok: false, error }` with a string code. */
function isResult(value: unknown): value is { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string } {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === true) return "value" in value;
  return value.ok === false && "error" in value && typeof value.error === "string";
}
