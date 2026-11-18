"use server";

// The page's server actions. The role is checked first, from the session, before the form is read (never from a
// bound argument, which the client controls, docs/02 §8). Next refuses an action from another origin, so these
// need no CSRF token of their own. Unexpected failures become `safeError` codes and are logged by kind only.
// `startOwnConnectionAction` and `disconnectOwnAction` act on the signed-in user's own connections (providers with
// `owner: "user"`): any signed-in user, never an admin role, and the owner is always the session's user.
import { authorizeRole, getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ConnectionFormState } from "../contract.js";
import { MAX_ID_LENGTH } from "../options.js";
import { disconnect, MAX_CREDENTIAL_LENGTH, saveCredential, type CredentialInput } from "../server/credentials.js";
import { startAuthorization } from "../server/flow.js";
import { findProvider, getConnectionsOptions, getConnectionsRoutes } from "../server/options.js";
import { getProviderOwner } from "../server/store.js";
import { getConnectionsContext } from "./context.js";

const field = (max: number) =>
  z
    .string()
    .catch("")
    .transform((value) => value.slice(0, max + 1));

const targetInput = z.object({ provider: field(MAX_ID_LENGTH), account: field(MAX_ID_LENGTH) });
const credentialInput = z.object({
  kind: z.enum(["api_key", "basic"]).catch("api_key"),
  apiKey: field(MAX_CREDENTIAL_LENGTH),
  username: field(MAX_CREDENTIAL_LENGTH),
  password: field(MAX_CREDENTIAL_LENGTH),
});

function readTarget(formData: FormData) {
  // Every field has a `catch`, so parsing cannot fail.
  const target = targetInput.parse({ provider: formData.get("provider"), account: formData.get("account") });
  return { provider: target.provider, accountId: target.account === "" ? undefined : target.account };
}

async function authorize(config: SoftureConfig) {
  return authorizeRole(getConnectionsOptions(config).panelRole);
}

function fail(operation: string, error: unknown): ConnectionFormState {
  console.error(`@softure-ai/connections: ${operation} failed: ${errorLogLabel(error)}`);
  return { status: "error", error: safeError(error).error };
}

/** Starts an OAuth authorization and sends the admin's browser to the provider. */
export async function startConnectionAction(_previous: ConnectionFormState, formData: FormData): Promise<ConnectionFormState> {
  const config = getSoftureConfig();
  const admin = await authorize(config);
  if (!admin.ok) return { status: "error", error: admin.error };
  const target = readTarget(formData);
  // The admin page starts the app's own connections only; a user connects their own account from their page.
  const found = findProvider(config, target.provider, target.accountId);
  if (found.ok && getProviderOwner(found.value) === "user") return { status: "error", error: "connections.wrong_owner" };
  let url: string;
  try {
    const started = await startAuthorization(await getConnectionsContext(config), { ...target, actorId: admin.value.id });
    if (!started.ok) return { status: "error", error: started.error };
    url = started.value.url;
  } catch (error) {
    return fail("starting an authorization", error);
  }
  // Outside the try: `redirect` throws by design.
  redirect(url);
}

/** Stores the API key or Basic credential an admin pasted. */
export async function saveCredentialAction(_previous: ConnectionFormState, formData: FormData): Promise<ConnectionFormState> {
  const config = getSoftureConfig();
  const admin = await authorize(config);
  if (!admin.ok) return { status: "error", error: admin.error };
  const input = credentialInput.parse({
    kind: formData.get("kind"),
    apiKey: formData.get("apiKey"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  const credential: CredentialInput =
    input.kind === "api_key" ? { kind: "api_key", apiKey: input.apiKey } : { kind: "basic", username: input.username, password: input.password };
  let result: Awaited<ReturnType<typeof saveCredential>>;
  try {
    result = await saveCredential(await getConnectionsContext(config), { ...readTarget(formData), credential, actorId: admin.value.id });
  } catch (error) {
    return fail("saving a credential", error);
  }
  if (!result.ok) return { status: "error", error: result.error };
  revalidatePath(getConnectionsRoutes(config).page);
  return { status: "ok" };
}

/** Deletes a connection (revoking an OAuth grant at the provider when it can). */
export async function disconnectAction(_previous: ConnectionFormState, formData: FormData): Promise<ConnectionFormState> {
  const config = getSoftureConfig();
  const admin = await authorize(config);
  if (!admin.ok) return { status: "error", error: admin.error };
  let result: Awaited<ReturnType<typeof disconnect>>;
  try {
    result = await disconnect(await getConnectionsContext(config), { ...readTarget(formData), actorId: admin.value.id });
  } catch (error) {
    return fail("disconnecting", error);
  }
  if (!result.ok) return { status: "error", error: result.error };
  revalidatePath(getConnectionsRoutes(config).page);
  return { status: "ok" };
}

/** The user provider the form names (`owner: "user"`), with its `returnPath`, or why not. */
function findOwnProvider(config: SoftureConfig, target: { readonly provider: string; readonly accountId: string | undefined }) {
  const found = findProvider(config, target.provider, target.accountId);
  if (!found.ok) return found;
  if (found.value.kind !== "oauth" || getProviderOwner(found.value) !== "user") return { ok: false as const, error: "connections.wrong_owner" as const };
  return { ok: true as const, value: found.value };
}

/** Starts the signed-in user's authorization of their own account (a provider with `owner: "user"`) and sends their browser there. */
export async function startOwnConnectionAction(_previous: ConnectionFormState, formData: FormData): Promise<ConnectionFormState> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return { status: "error", error: "auth.forbidden" };
  const target = readTarget(formData);
  const provider = findOwnProvider(config, target);
  if (!provider.ok) return { status: "error", error: provider.error };
  let url: string;
  try {
    const started = await startAuthorization(await getConnectionsContext(config), { ...target, actorId: user.id });
    if (!started.ok) return { status: "error", error: started.error };
    url = started.value.url;
  } catch (error) {
    return fail("starting an authorization", error);
  }
  // Outside the try: `redirect` throws by design.
  redirect(url);
}

/** Deletes the signed-in user's own connection (revoking the grant at the provider when it can). */
export async function disconnectOwnAction(_previous: ConnectionFormState, formData: FormData): Promise<ConnectionFormState> {
  const config = getSoftureConfig();
  const user = await getCurrentUser();
  if (user === null) return { status: "error", error: "auth.forbidden" };
  const target = readTarget(formData);
  const provider = findOwnProvider(config, target);
  if (!provider.ok) return { status: "error", error: provider.error };
  let result: Awaited<ReturnType<typeof disconnect>>;
  try {
    result = await disconnect(await getConnectionsContext(config), { ...target, ownerId: user.id, actorId: user.id });
  } catch (error) {
    return fail("disconnecting", error);
  }
  if (!result.ok) return { status: "error", error: result.error };
  if (provider.value.returnPath !== undefined) revalidatePath(provider.value.returnPath);
  return { status: "ok" };
}
