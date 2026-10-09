// A server action as a write tool: the tool's arguments become the form the action reads, so the tool
// and the form share one validation path, and the action's error state becomes a tool error.
import type { CallToolResult } from "@modelcontextprotocol/server";
import { describeCode, toolError, toolResult, withToolErrors, type ToolErrorHints } from "./tools.js";

/** The action, called with the form. A `useActionState` action is passed as `(form) => action(INITIAL, form)`. */
export type FormActionHandler = (formData: FormData) => unknown;

export interface ActionToolOptions {
  /** The answer on success: a text, or a text built from the action's state. Default: the state as JSON. */
  readonly message?: string | ((state: unknown) => string);
  /** Texts per error code, as in `withToolErrors`. */
  readonly hints?: ToolErrorHints;
  /** The tool's name in the log line. */
  readonly label?: string;
}

/** The tool callback for `server.registerTool(name, { inputSchema }, actionTool(handler))`. */
export function actionTool(handler: FormActionHandler, options: ActionToolOptions = {}): (args: Readonly<Record<string, unknown>>) => Promise<CallToolResult> {
  const hints = options.hints ?? {};
  return (args) =>
    withToolErrors(
      async () => {
        const state = await handler(toFormData(args));
        const error = readErrorCode(state);
        if (error !== null) return toolError(describeCode(error, hints));
        if (options.message === undefined) return toolResult(state);
        return toolResult(typeof options.message === "string" ? options.message : options.message(state));
      },
      { hints, ...(options.label === undefined ? {} : { label: options.label }) },
    );
}

/**
 * Arguments as a submitted form: strings as they are, numbers as text, `true` as `"on"` (a checked
 * checkbox) and `false`, `null` and `undefined` left out (an unchecked one), arrays one entry per item,
 * dates as ISO text, objects as JSON.
 */
export function toFormData(args: Readonly<Record<string, unknown>>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(args)) {
    for (const item of Array.isArray(value) ? (value as unknown[]) : [value]) {
      const field = toFieldValue(item);
      if (field !== null) form.append(name, field);
    }
  }
  return form;
}

function toFieldValue(value: unknown): string | null {
  if (value === undefined || value === null || value === false) return null;
  if (value === true) return "on";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

/** The error code of an action state: `{ ok: false, error }` (core's result) or `{ status: "error", error }` (a form state). */
function readErrorCode(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("error" in state) || typeof state.error !== "string") return null;
  const isFailure = ("ok" in state && state.ok === false) || ("status" in state && state.status === "error");
  return isFailure ? state.error : null;
}
