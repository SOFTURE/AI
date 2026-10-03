"use server";

// The token page's server actions. The owner comes from the session (never from a bound argument,
// which the client controls, docs/02 §8) before the form is read, and every query is scoped to
// that owner. Unexpected failures become `safeError` codes; the token never reaches a log.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, formatMessage, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMcpClientSetup } from "../client-setup.js";
import type { IssueTokenFormState, RevokeTokenFormState } from "../contract.js";
import { MAX_TOKEN_NAME_LENGTH } from "../options.js";
import { getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes, getMcpEndpointUrl } from "../server/options.js";
import { issueAccessToken, revokeAccessToken } from "../server/tokens.js";
import { getMcpAccessContext } from "./context.js";
import { formatDate } from "./format.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = MAX_TOKEN_NAME_LENGTH * 4;
const text = z
  .string()
  .catch("")
  .transform((value) => value.slice(0, MAX_FIELD_LENGTH));

const issueInput = z.object({
  name: text,
  // A checked HTML checkbox sends "on"; an unchecked one sends nothing, which means read only.
  canWrite: z.string().nullable().catch(null),
});
const revokeInput = z.object({ id: text });

function reportFailure(operation: string, error: unknown) {
  console.error(`@softure-ai/mcp-access: ${operation} failed: ${errorLogLabel(error)}`);
  return safeError(error).error;
}

function refreshPage(config: SoftureConfig): void {
  revalidatePath(getMcpAccessRoutes(config).page);
}

/** Issues a token for the signed-in user and returns its plaintext with the setup snippets, once. */
export async function issueTokenAction(_previous: IssueTokenFormState, formData: FormData): Promise<IssueTokenFormState> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return { status: "error", error: "auth.unauthenticated" };

  // Every field has a `catch`, so parsing cannot fail.
  const input = issueInput.parse({ name: formData.get("name"), canWrite: formData.get("canWrite") });
  try {
    const result = await issueAccessToken(await getMcpAccessContext(config), { userId: user.id, name: input.name, canWrite: input.canWrite !== null });
    if (!result.ok) return { status: "error", error: result.error };
    refreshPage(config);
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
          endpointUrl: getMcpEndpointUrl(config),
          token: issued.token,
          promptTemplate: messages.setup.assistantPrompt,
        }),
      },
    };
  } catch (error) {
    return { status: "error", error: reportFailure("issuing a token", error) };
  }
}

/** Revokes one of the signed-in user's tokens; another account's id matches nothing. */
export async function revokeTokenAction(_previous: RevokeTokenFormState, formData: FormData): Promise<RevokeTokenFormState> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return { status: "error", error: "auth.unauthenticated" };

  const input = revokeInput.parse({ id: formData.get("id") });
  try {
    const result = await revokeAccessToken(await getMcpAccessContext(config), { userId: user.id, tokenId: input.id });
    if (!result.ok) return { status: "error", error: result.error };
    refreshPage(config);
    return { status: "ok" };
  } catch (error) {
    return { status: "error", error: reportFailure("revoking a token", error) };
  }
}
