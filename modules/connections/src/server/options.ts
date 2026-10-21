// The connections options of the running app, read from the configuration in the module context.
import { err, getModule, ok, pickLocalizedText, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { DEFAULT_ACCOUNT_ID, type ConnectionsOptions, type OAuthProviderDefinition, type ProviderDefinition } from "../options.js";
import type { Env } from "./crypto.js";
import type { ClientCredentials } from "./token-client.js";

const MODULE_ID = "connections";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getConnectionsModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/connections: the module is not enabled; add connections({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getConnectionsOptions(config: SoftureConfig): ConnectionsOptions {
  // The module factory parsed these options with connectionsOptionsSchema.
  return getConnectionsModule(config).options as ConnectionsOptions;
}

export interface ConnectionsRoutes {
  readonly page: string;
  readonly callback: string;
}

/** The module's routes after the app's overrides (`connections({ routes: { page, callback } })`). */
export function getConnectionsRoutes(config: SoftureConfig): ConnectionsRoutes {
  const { page, callback } = getConnectionsModule(config).routes;
  // The manifest declares both, so a missing one means a broken module definition.
  if (page === undefined || callback === undefined) throw new Error("@softure-ai/connections: a route is missing from the module manifest");
  return { page, callback };
}

/** The redirect URI registered with every provider: the app's canonical origin and the callback route. */
export function getRedirectUri(config: SoftureConfig): string {
  return new URL(getConnectionsRoutes(config).callback, config.appOrigin).toString();
}

export type ProviderLookup = Ok<ProviderDefinition> | Err<"connections.unknown_provider">;

/** The declared provider `id` that has the account `accountId`. */
export function findProvider(config: SoftureConfig, id: string, accountId: string = DEFAULT_ACCOUNT_ID): ProviderLookup {
  const provider = getConnectionsOptions(config).providers.find((candidate) => candidate.id === id);
  return provider?.accounts.includes(accountId) === true ? ok(provider) : err("connections.unknown_provider");
}

/** The provider's label in the app's locale, else its id. */
export function getProviderLabel(config: SoftureConfig, provider: ProviderDefinition): string {
  return pickLocalizedText(provider.label, config.locale, provider.id);
}

export type ClientLookup = Ok<ClientCredentials> | Err<"connections.provider_not_configured">;

/** The client id and secret, read from the environment when the flow needs them. */
export function readClientCredentials(provider: OAuthProviderDefinition, env: Env = process.env): ClientLookup {
  const clientId = provider.clientId ?? readVariable(env, provider.clientIdEnv);
  if (clientId === null) return err("connections.provider_not_configured");
  if (provider.clientSecretEnv === undefined) return ok({ clientId, clientSecret: null });
  const clientSecret = readVariable(env, provider.clientSecretEnv);
  return clientSecret === null ? err("connections.provider_not_configured") : ok({ clientId, clientSecret });
}

function readVariable(env: Env, name: string | undefined): string | null {
  const value = name === undefined ? undefined : env[name]?.trim();
  return value === undefined || value === "" ? null : value;
}
