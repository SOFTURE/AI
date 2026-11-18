// A provider the app's own users connect their accounts at (a cloud drive, a code host): where its OAuth 2.0
// endpoints are and how the app authenticates there. Defined in code, not in `connections({ providers })`: these
// grants belong to the users, kept by the app beside its own records, not to the admin's connections table. The
// client id and secret are passed per call, so the definition holds nothing secret and `next build` needs no secret.
import { z } from "zod";
import { MAX_ID_LENGTH, PROVIDER_ID_PATTERN } from "../options.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const RESERVED_AUTHORIZE_PARAMS = new Set(["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"]);

/** An https URL, or http on a loopback host (a provider emulator in development and end-to-end tests). */
const endpointSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}, "must be an https URL (http only on localhost)");

const revokeSchema = z.discriminatedUnion("style", [
  /** RFC 7009: the token in a form with the client's credentials. */
  z.strictObject({ style: z.literal("rfc7009"), url: endpointSchema }),
  /** A bare POST with `Authorization: Bearer <access token>` (Dropbox): revokes the grant behind that token. */
  z.strictObject({ style: z.literal("bearer"), url: endpointSchema }),
]);

const userOAuthProviderSchema = z
  .strictObject({
    id: z
      .string()
      .max(MAX_ID_LENGTH, `must be at most ${String(MAX_ID_LENGTH)} characters`)
      .regex(PROVIDER_ID_PATTERN, "must be kebab-case, e.g. dropbox"),
    authorizeUrl: endpointSchema,
    tokenUrl: endpointSchema,
    /** How a grant is revoked when the user disconnects; none when the provider has no endpoint for it. */
    revoke: revokeSchema.optional(),
    scopes: z.array(z.string().min(1).max(500).regex(/^[^\s]+$/, "must not contain spaces")).default([]),
    scopeSeparator: z.enum([" ", ","]).default(" "),
    /** Client credentials in the token request's form, or as HTTP Basic. */
    clientAuth: z.enum(["body", "basic"]).default("body"),
    /** Extra authorize parameters, e.g. `{ token_access_type: "offline" }`; the ones the flow sets are refused. */
    authorizeParams: z.record(z.string().min(1).max(100), z.string().max(2000)).default({}),
    /** PKCE S256 on the authorization code flow. */
    pkce: z.boolean().default(true),
    /** The provider spends a refresh token on use; a refresh then answers a new one the app must store. */
    rotatesRefreshToken: z.boolean().default(false),
  })
  .superRefine((provider, context) => {
    for (const name of Object.keys(provider.authorizeParams)) {
      if (RESERVED_AUTHORIZE_PARAMS.has(name)) context.addIssue({ code: "custom", path: ["authorizeParams", name], message: "is set by the flow" });
    }
  });

export type UserOAuthProviderInput = z.input<typeof userOAuthProviderSchema>;
export type UserOAuthProvider = Readonly<z.output<typeof userOAuthProviderSchema>>;

/** The app's client at a provider. The secret is null for a public client (which then relies on PKCE). */
export interface UserOAuthClient {
  readonly clientId: string;
  readonly clientSecret: string | null;
}

/**
 * Parses a provider definition. A wrong one is a programming error in the app, so it throws a `TypeError` naming
 * the field, at the place the provider is defined.
 */
export function defineUserOAuthProvider(input: UserOAuthProviderInput): UserOAuthProvider {
  const parsed = userOAuthProviderSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue === undefined ? "" : issue.path.map(String).join(".");
  throw new TypeError(`defineUserOAuthProvider: ${path === "" ? "" : `${path} `}${issue?.message ?? "is invalid"}`);
}
