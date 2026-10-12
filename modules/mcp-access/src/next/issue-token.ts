// Issuing a token from the token page's form, with an optional gate the app puts in front of it (a
// billing write gate). Not a server action itself: the app calls it from its own `"use server"` file,
// so the gate stays in the app's code and out of softure.config.ts:
//
//   "use server";
//   export async function issueGatedToken(previous: IssueTokenFormState, form: FormData) {
//     return issueToken(previous, form, { beforeIssue: checkPlan });
//   }
//
// The owner comes from the session (never from a bound argument, which the client controls, docs/02 §8)
// before the form is read. The gate refuses with a code, a code and its own text, or a thrown
// `PublicError`; any other failure, the gate's included, becomes a `safeError` code.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, formatMessage, getPublicMessage, safeError, type Err, type Ok } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMcpClientSetup } from "../client-setup.js";
import type { IssueTokenFormState, McpIssueRefusal, McpIssueRefusalCode } from "../contract.js";
import { MAX_TOKEN_NAME_LENGTH } from "../options.js";
import { getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes, getMcpEndpointUrl } from "../server/options.js";
import { issueAccessToken } from "../server/tokens.js";
import { getMcpAccessContext, getRequestOrigins } from "./context.js";
import { formatDate } from "./format.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = MAX_TOKEN_NAME_LENGTH * 4;

const issueInput = z.object({
  name: z
    .string()
    .catch("")
    .transform((value) => value.slice(0, MAX_FIELD_LENGTH)),
  // A checked HTML checkbox sends "on"; an unchecked one sends nothing, which means read only.
  canWrite: z.string().nullable().catch(null),
});

/** What the gate learns about the token about to be issued. */
export interface IssueGateInput {
  readonly userId: string;
  readonly canWrite: boolean;
}

/**
 * How the gate answers: `ok()` lets the token through, `err(code)` refuses with the code's copy,
 * `refuseIssue(code, message)` with the app's own text.
 */
export type IssueGateResult = Ok<unknown> | Err<McpIssueRefusalCode> | McpIssueRefusal;

/** The app's check before a token is issued. Throwing a `PublicError` refuses too, with its message. */
export type BeforeIssueGate = (input: IssueGateInput) => IssueGateResult | Promise<IssueGateResult>;

export interface IssueTokenOptions {
  readonly beforeIssue?: BeforeIssueGate;
}

/** Issues a token for the signed-in user, after the gate, and returns its plaintext with the setup snippets, once. */
export async function issueToken(_previous: IssueTokenFormState, formData: FormData, options: IssueTokenOptions = {}): Promise<IssueTokenFormState> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return { status: "error", error: "auth.unauthenticated" };

  // Every field has a `catch`, so parsing cannot fail.
  const input = issueInput.parse({ name: formData.get("name"), canWrite: formData.get("canWrite") });
  const canWrite = input.canWrite !== null;
  try {
    if (options.beforeIssue !== undefined) {
      const gate = await options.beforeIssue({ userId: user.id, canWrite });
      if (!gate.ok) return getRefusalState(gate.error, "message" in gate ? gate.message : undefined);
    }
    // Resolved before issuing: a failure afterwards would leave a token nobody received.
    const endpointUrl = getMcpEndpointUrl(config, await getRequestOrigins(config, getMcpAccessRoutes(config).page));
    const result = await issueAccessToken(await getMcpAccessContext(config), { userId: user.id, name: input.name, canWrite });
    if (!result.ok) return { status: "error", error: result.error };
    revalidatePath(getMcpAccessRoutes(config).page);
    const issued = result.value;
    const messages = getMcpAccessMessages(config);
    const accessOptions = getMcpAccessOptions(config);
    return {
      status: "ok",
      issued: {
        id: issued.id,
        name: issued.name,
        canWrite: issued.canWrite,
        expiresText: formatMessage(messages.issued.expires, { date: formatDate(config, issued.expiresAt) }),
        expiresAt: issued.expiresAt.toISOString(),
        setup: getMcpClientSetup({
          serverName: accessOptions.clientServerName ?? accessOptions.serverName,
          endpointUrl,
          token: issued.token,
          promptTemplate: messages.setup.assistantPrompt,
        }),
      },
    };
  } catch (error) {
    // A deliberate refusal written for the user, not a failure: shown, not logged.
    const publicMessage = getPublicMessage(error);
    if (publicMessage !== null) return getRefusalState("mcp-access.issue_refused", publicMessage);
    console.error(`@softure-ai/mcp-access: issuing a token failed: ${errorLogLabel(error)}`);
    return { status: "error", error: safeError(error).error };
  }
}

/** A gate's refusal with the app's own text, which the token page shows instead of the code's copy. */
export function refuseIssue(code: McpIssueRefusalCode, message: string): McpIssueRefusal {
  return { ok: false, error: code, message };
}

/** The form state for a gate's refusal; a missing or blank text falls back to the code's copy. */
function getRefusalState(code: McpIssueRefusalCode, text: unknown): IssueTokenFormState {
  const message = typeof text === "string" ? text.trim() : "";
  return message === "" ? { status: "error", error: code } : { status: "error", error: code, message };
}
