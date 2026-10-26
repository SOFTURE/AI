// What the OpenID Connect functions receive besides the auth context, and the lookups they share.
import type { SoftureConfig } from "@softure-ai/core";
import type { OidcProvider } from "../../options.js";
import { getAuthOptions } from "../options.js";
import type { AuthContext } from "../sessions.js";

/**
 * A step's outcome inside the flow: its value, or the reason it failed. The reason is this module's own wording for
 * the log, never shown to the user (who gets `auth.oidc_failed`) and never a value from the provider.
 */
export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

export function passed<T>(value: T): Checked<T> {
  return { ok: true, value };
}

export function refused(reason: string): { readonly ok: false; readonly reason: string } {
  return { ok: false, reason };
}

/** The auth context, plus the environment the client id and secret are read from (default `process.env`). */
export type OidcContext = AuthContext & { readonly env?: Readonly<Record<string, string | undefined>> };

/** The path a provider sends the browser back to, mounted at `app/api/auth/oidc/[provider]/callback/route.ts`. */
export function getOidcCallbackPath(providerId: string): string {
  return `/api/auth/oidc/${providerId}/callback`;
}

/** The callback as an absolute URL on `appOrigin`: the `redirect_uri` registered at the provider. */
export function getOidcRedirectUri(config: SoftureConfig, providerId: string): string {
  return new URL(getOidcCallbackPath(providerId), config.appOrigin).toString();
}

/** The configured providers, in their order; empty when OpenID Connect sign-in is off. */
export function getOidcProviders(config: SoftureConfig): readonly OidcProvider[] {
  return getAuthOptions(config).oidc.providers;
}

export function findOidcProvider(config: SoftureConfig, providerId: string): OidcProvider | undefined {
  return getOidcProviders(config).find((provider) => provider.id === providerId);
}

export interface OidcClient {
  readonly clientId: string;
  readonly clientSecret: string | null;
}

/** The client id and secret from the environment; a missing one is named (never its value) in the error. */
export function readOidcClient(ctx: OidcContext, provider: OidcProvider): Checked<OidcClient> {
  const env = ctx.env ?? process.env;
  const clientId = env[provider.clientIdEnv]?.trim() ?? "";
  if (clientId === "") return refused(`${provider.clientIdEnv} is not set`);
  if (provider.clientSecretEnv === undefined) return passed({ clientId, clientSecret: null });
  const clientSecret = env[provider.clientSecretEnv]?.trim() ?? "";
  return clientSecret === "" ? refused(`${provider.clientSecretEnv} is not set`) : passed({ clientId, clientSecret });
}
