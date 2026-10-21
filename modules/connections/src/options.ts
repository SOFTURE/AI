// The options an app passes to `connections({ ... })` in softure.config.ts, parsed at startup. Secrets are
// never options: a client secret is named by its environment variable and read when a flow needs it, so
// `next build` runs without it.
import { isLocale, type FetchFunction, type ModuleContext } from "@softure-ai/core";
import { z } from "zod";
import type { ReconnectRequiredEvent } from "./contract.js";

/** A provider id: kebab-case, at most 64 characters (`google`, `google-calendar`). */
export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** An account id of a provider: lowercase letters, digits, `_` and `-` (`default`, `work`). */
export const ACCOUNT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
export const MAX_ID_LENGTH = 64;
/** The account a provider has when the app names none. */
export const DEFAULT_ACCOUNT_ID = "default";

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
/** The same pattern auth enforces for role names. */
const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Copy per locale; a locale without its own text falls back to `en`, then to the provider id. */
const localizedTextSchema = z.record(z.string().refine(isLocale, "must be a BCP 47 language tag"), z.string().trim().min(1).max(500));

/** An https URL, or http on localhost (a provider emulator in development). */
const endpointSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}, "must be an https URL (http only on localhost)");

const envNameSchema = z.string().regex(ENV_NAME_PATTERN, "must be an environment variable name such as GOOGLE_CLIENT_SECRET");

const providerBase = {
  id: z
    .string()
    .max(MAX_ID_LENGTH, `must be at most ${String(MAX_ID_LENGTH)} characters`)
    .regex(PROVIDER_ID_PATTERN, "must be kebab-case, e.g. google-calendar"),
  /** The page's name for the provider. */
  label: localizedTextSchema.optional(),
  /** The accounts the app keeps for this provider; one `default` unless it names several (`["work", "personal"]`). */
  accounts: z
    .array(z.string().max(MAX_ID_LENGTH).regex(ACCOUNT_ID_PATTERN, "must be lowercase letters, digits, _ or -, e.g. work"))
    .min(1)
    .default([DEFAULT_ACCOUNT_ID]),
};

const oauthProviderSchema = z.strictObject({
  kind: z.literal("oauth"),
  ...providerBase,
  authorizeUrl: endpointSchema,
  tokenUrl: endpointSchema,
  /** RFC 7009 revocation endpoint, called (best effort) on disconnect. */
  revokeUrl: endpointSchema.optional(),
  scopes: z.array(z.string().min(1).max(500).regex(/^[^\s]+$/, "must not contain spaces")).default([]),
  /** How the scopes are joined in the authorize URL; a few providers use `,`. */
  scopeSeparator: z.enum([" ", ","]).default(" "),
  /** The client id itself (it is public), or `clientIdEnv`. */
  clientId: z.string().min(1).max(500).optional(),
  /** The variable that holds the client id. */
  clientIdEnv: envNameSchema.optional(),
  /** The variable that holds the client secret; omit it for a public client, which relies on PKCE. */
  clientSecretEnv: envNameSchema.optional(),
  /** How the client authenticates at the token endpoint: in the form body, or with HTTP Basic. */
  clientAuth: z.enum(["body", "basic"]).default("body"),
  /** Extra authorize parameters, e.g. `{ access_type: "offline", prompt: "consent" }`. */
  authorizeParams: z.record(z.string().min(1).max(100), z.string().max(2000)).default({}),
  /** PKCE S256 on the authorization code flow. */
  pkce: z.boolean().default(true),
  /** The provider spends a refresh token on use and answers with a new one; a refresh without one needs a reconnect. */
  rotatesRefreshToken: z.boolean().default(false),
  /** How long the provider keeps a refresh token at most (Google testing mode: 7), for the page's "expiring" state. */
  refreshTokenMaxAgeDays: z.number().int().min(1).max(3650).optional(),
});

const keyProviderShape = {
  ...providerBase,
  /** A line under the form: where the admin finds the key. */
  hint: localizedTextSchema.optional(),
};

const apiKeyProviderSchema = z.strictObject({ kind: z.literal("api_key"), ...keyProviderShape });
const basicProviderSchema = z.strictObject({ kind: z.literal("basic"), ...keyProviderShape });

const providerSchema = z.discriminatedUnion("kind", [oauthProviderSchema, apiKeyProviderSchema, basicProviderSchema]);

/** Runs after `connections.reconnect_required` is stored for a connection that was connected, once per transition. */
export type OnReconnectRequiredHook = (event: ReconnectRequiredEvent, context: ModuleContext) => void | Promise<void>;

const RESERVED_AUTHORIZE_PARAMS = new Set(["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"]);

export const connectionsOptionsSchema = z
  .strictObject({
    providers: z.array(providerSchema).default([]),
    /** The auth role that opens the page, connects and disconnects. */
    panelRole: z.string().regex(ROLE_NAME_PATTERN, "must be a role name such as admin").default("admin"),
    /** An access token this close to its expiry is refreshed before it is handed out. */
    refreshSkewSeconds: z.number().int().min(0).max(3600).default(300),
    /** A connection whose refresh token (or, without one, access token) dies within this many hours shows as expiring. */
    expiringWithinHours: z.number().int().min(1).max(24 * 90).default(72),
    /** How long one worker holds a connection's refresh lease; longer than `httpTimeoutMs`. */
    refreshLeaseSeconds: z.number().int().min(5).max(600).default(30),
    /** How a caller waits while another worker refreshes the same connection. */
    refreshWait: z
      .strictObject({ attempts: z.number().int().min(0).max(1000), intervalMs: z.number().int().min(1).max(10_000) })
      .default({ attempts: 40, intervalMs: 250 }),
    /** How long an authorization may take, from the connect button to the callback. */
    stateTtlMinutes: z.number().int().min(1).max(60).default(10),
    /** The timeout of a token, exchange or revoke call. */
    httpTimeoutMs: z.number().int().min(100).max(120_000).default(10_000),
    onReconnectRequired: z.custom<OnReconnectRequiredHook>((value) => typeof value === "function", "must be a function").optional(),
    /** The `fetch` the token client uses; tests pass a fake provider's. */
    fetch: z.custom<FetchFunction>((value) => typeof value === "function", "must be a function").optional(),
  })
  .superRefine((options, context) => {
    const ids = new Set<string>();
    options.providers.forEach((provider, index) => {
      if (ids.has(provider.id)) {
        context.addIssue({ code: "custom", path: ["providers", index, "id"], message: `"${provider.id}" is declared twice` });
      }
      ids.add(provider.id);
      if (new Set(provider.accounts).size !== provider.accounts.length) {
        context.addIssue({ code: "custom", path: ["providers", index, "accounts"], message: "must not repeat an account" });
      }
      if (provider.kind !== "oauth") return;
      if ((provider.clientId === undefined) === (provider.clientIdEnv === undefined)) {
        context.addIssue({ code: "custom", path: ["providers", index, "clientId"], message: "give exactly one of clientId and clientIdEnv" });
      }
      if (provider.clientSecretEnv === undefined && !provider.pkce) {
        context.addIssue({ code: "custom", path: ["providers", index, "pkce"], message: "a public client (no clientSecretEnv) needs pkce" });
      }
      for (const name of Object.keys(provider.authorizeParams)) {
        if (RESERVED_AUTHORIZE_PARAMS.has(name)) {
          context.addIssue({ code: "custom", path: ["providers", index, "authorizeParams", name], message: "is set by the module" });
        }
      }
    });
    if (options.refreshLeaseSeconds * 1000 <= options.httpTimeoutMs) {
      context.addIssue({ code: "custom", path: ["refreshLeaseSeconds"], message: "must be longer than httpTimeoutMs" });
    }
  });

export type ConnectionsOptionsInput = z.input<typeof connectionsOptionsSchema>;
export type ConnectionsOptions = z.output<typeof connectionsOptionsSchema>;
export type ProviderDefinitionInput = z.input<typeof providerSchema>;
export type ProviderDefinition = z.output<typeof providerSchema>;
export type OAuthProviderDefinition = z.output<typeof oauthProviderSchema>;
export type KeyProviderDefinition = z.output<typeof apiKeyProviderSchema> | z.output<typeof basicProviderSchema>;
