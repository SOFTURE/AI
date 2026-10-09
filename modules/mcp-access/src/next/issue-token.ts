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
// before the form is read. Unexpected failures, the gate's included, become `safeError` codes.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, formatMessage, safeError, type Err, type Ok } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMcpClientSetup } from "../client-setup.js";
import type { IssueTokenFormState, McpIssueRefusalCode } from "../contract.js";
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

/** The app's check before a token is issued: `ok()` lets it through, `err(code)` refuses with a message the page shows. */
export type BeforeIssueGate = (input: IssueGateInput) => Ok<unknown> | Err<McpIssueRefusalCode> | Promise<Ok<unknown> | Err<McpIssueRefusalCode>>;

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
      if (!gate.ok) return { status: "error", error: gate.error };
    }
    // Resolved before issuing: a failure afterwards would leave a token nobody received.
    const endpointUrl = getMcpEndpointUrl(config, await getRequestOrigins(config, getMcpAccessRoutes(config).page));
    const result = await issueAccessToken(await getMcpAccessContext(config), { userId: user.id, name: input.name, canWrite });
    if (!result.ok) return { status: "error", error: result.error };
    revalidatePath(getMcpAccessRoutes(config).page);
    const issued = result.value;
    const messages = getMcpAccessMessages(config);
    return {
      status: "ok",
      issued: {
        id: issued.id,
        name: issued.name,
        canWrite: issued.canWrite,
        expiresText: formatMessage(messages.issued.expires, { date: formatDate(config, issued.expiresAt) }),
        setup: getMcpClientSetup({
          serverName: getMcpAccessOptions(config).serverName,
          endpointUrl,
          token: issued.token,
          promptTemplate: messages.setup.assistantPrompt,
        }),
      },
    };
  } catch (error) {
    console.error(`@softure-ai/mcp-access: issuing a token failed: ${errorLogLabel(error)}`);
    return { status: "error", error: safeError(error).error };
  }
}
