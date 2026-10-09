// Tool results for the app's MCP server and the boundary that keeps failures safe: the assistant gets
// a value, a `PublicError`'s message or a hint, never a thrown error's text (a failed query carries
// its SQL and parameters). The log gets the error's kind only (`errorLogLabel`).
import { isCallToolResult, type CallToolResult } from "@modelcontextprotocol/server";
import { errorLogLabel, getPublicMessage, safeError } from "@softure-ai/core";

/** What the assistant reads for an error code: the app's own text per code, e.g. `{ "orders.not_found": "No order with that number." }`. */
export type ToolErrorHints = Readonly<Record<string, string>>;

export interface ToolErrorOptions {
  /** Texts per error code; a code without one is answered as the code itself. */
  readonly hints?: ToolErrorHints;
  /** The tool's name in the log line. */
  readonly label?: string;
}

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
  try {
    return answerValue(await work(), options.hints);
  } catch (error) {
    return answerFailure(error, options);
  }
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
