// Token and key reads for server components, actions and route handlers, with the registered config. Nothing is
// cached: a refresh stored by another instance is read on the next call.
import { getSoftureConfig } from "@softure-ai/core/next";
import { sendWithConnection, type ConnectionRequestOptions, type RequestWithConnection } from "../server/request.js";
import { getCredential as getStoredCredential, type GetCredentialResult, type ProviderAccountInput } from "../server/credentials.js";
import { getAccessToken as getServerAccessToken, type GetAccessTokenInput, type GetAccessTokenResult } from "../server/tokens.js";
import { getConnectionsContext } from "./context.js";

/** A usable access token for the provider account (`getAccessToken` of `/server`). */
export async function getAccessToken(input: GetAccessTokenInput): Promise<GetAccessTokenResult> {
  return getServerAccessToken(await getConnectionsContext(getSoftureConfig()), input);
}

/** The stored API key or Basic credential of the provider account (`getCredential` of `/server`). */
export async function getCredential(input: ProviderAccountInput): Promise<GetCredentialResult> {
  return getStoredCredential(await getConnectionsContext(getSoftureConfig()), input);
}

/** Calls a provider's API with the account's stored credential (`requestWithConnection` of `/server`). */
export const requestWithConnection = (async (account: ProviderAccountInput, options: ConnectionRequestOptions) =>
  sendWithConnection(await getConnectionsContext(getSoftureConfig()), account, options)) as RequestWithConnection<[account: ProviderAccountInput]>;
