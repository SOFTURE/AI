// The options an app passes to `auth({ ... })` in softure.config.ts, parsed at startup.
import type { FetchFunction, ModuleContext, SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { z } from "zod";
import type { RegisteredEvent } from "./contract.js";
import type { PasswordResetEnqueuer, PasswordResetSender } from "./password-reset-sender.js";
import { ROLE_NAME_PATTERN } from "./roles.js";

/**
 * OWASP's scrypt cost for passwords: N = 2^17, r = 8, p = 1. One hash takes 128 * N * r bytes
 * (128 MiB) and about 0.4 s of a core; Node runs up to four at once on its libuv pool, so a burst of
 * logins can take 512 MiB. A small server lowers `password.scrypt.cost` (README §3).
 */
export const DEFAULT_SCRYPT_COST = 2 ** 17;

const MAX_EMAIL_LENGTH = 254;
const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
/** A legacy cookie may carry its own prefix (`__Host-session`) or a dot. */
const LEGACY_COOKIE_NAME = /^[A-Za-z0-9_.-]{1,128}$/;
const DEFAULT_COOKIE_NAME = "softure_session";
const REGISTRATION_FIELD_NAME = /^[a-z][a-zA-Z0-9_]{0,31}$/;
/** The register form's own fields, which an app field must not shadow. */
const REGISTER_FORM_FIELDS: ReadonlySet<string> = new Set(["email", "password", "next", "consent"]);
const DOMAIN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Runs inside the registration transaction; a thrown error rolls the registration back. */
export type OnRegisteredHook = (event: RegisteredEvent, ctx: ModuleContext<Queryable>) => Promise<void>;

/** What a redirect rewrite gets besides the path. */
export interface RewriteRedirectContext {
  readonly config: SoftureConfig;
  /**
   * The page's own search params, when a page redirects while it renders (the login and register
   * pages send a signed-in visitor on); absent for an action's redirect. A render's `Referer` is the
   * page before, not this one.
   */
  readonly searchParams?: URLSearchParams;
}

/**
 * Rewrites the path auth redirects to (after login, sign-up, a password reset and logout, and the
 * login and register pages' redirect of a signed-in visitor), e.g. analytics' `tagRedirect`, which
 * keeps the channel tag. A result that is not a path on this app, or a failure, leaves auth's own path.
 */
export type RewriteRedirect = (path: string, ctx: RewriteRedirectContext) => Promise<string> | string;

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(Math.log2(value));
}

const scryptSchema = z.strictObject({
  /** N: CPU and memory cost, a power of two. */
  cost: z
    .number()
    .int()
    .min(2 ** 10)
    .max(2 ** 20)
    .refine(isPowerOfTwo, "must be a power of two")
    .default(DEFAULT_SCRYPT_COST),
  /** r: block size. */
  blockSize: z.number().int().min(1).max(32).default(8),
  /** p: parallelization. */
  parallelization: z.number().int().min(1).max(16).default(1),
});

const adminEmailSchema = z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).pipe(z.email("must be an email address"));

/**
 * `adminEmails` given as the raw environment string: entries split on commas and whitespace, trimmed and
 * lowercased. One bad entry must not stop the app, so entries that are not emails are dropped with one log
 * line naming their positions (never their values) and grant nothing.
 */
function parseAdminEmailList(raw: string): string[] {
  const entries = raw.split(/[\s,]+/).filter((entry) => entry !== "");
  const emails: string[] = [];
  const dropped: number[] = [];
  entries.forEach((entry, index) => {
    const parsed = adminEmailSchema.safeParse(entry);
    if (parsed.success) emails.push(parsed.data);
    else dropped.push(index + 1);
  });
  if (dropped.length > 0) {
    const positions = dropped.join(", ");
    console.warn(`@softure-ai/auth: adminEmails: ${String(dropped.length)} of ${String(entries.length)} entries are not email addresses and grant no role (positions ${positions})`);
  }
  return emails;
}

/** A provider id: the path segment of its callback (`/api/auth/oidc/<id>/callback`) and the key of its identities. */
export const OIDC_PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const GOOGLE_ISSUER = "https://accounts.google.com";
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,127}$/;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** An https URL, or http on the local machine (a development identity provider). */
export function isSecureEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== "" || url.password !== "" || url.hash !== "") return false;
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

const domainSchema = z.string().trim().toLowerCase().regex(DOMAIN, "must be a lowercase host name such as example.com");

const oidcProviderSchema = z
  .strictObject({
    /** The provider's id in URLs and in `auth.identities`, e.g. `google`. */
    id: z.string().regex(OIDC_PROVIDER_ID_PATTERN, "must be an id such as google (a-z first, then a-z, 0-9 or -, at most 32)"),
    /** The provider's name as the button shows it (`messages.oidc.signInWith`), e.g. `Google`. */
    name: z.string().trim().min(1).max(64),
    /** The issuer; its discovery document is `<issuer>/.well-known/openid-configuration`. */
    issuer: z
      .string()
      .refine(isSecureEndpoint, "must be an https URL (http only on localhost)")
      .transform((issuer) => issuer.replace(/\/+$/, "")),
    /** The environment variable that holds the client id. */
    clientIdEnv: z.string().regex(ENV_NAME, "must be an environment variable name such as GOOGLE_AUTH_CLIENT_ID"),
    /** The environment variable that holds the client secret; absent for a public client. */
    clientSecretEnv: z.string().regex(ENV_NAME, "must be an environment variable name such as GOOGLE_AUTH_CLIENT_SECRET").optional(),
    /** How the client authenticates at the token endpoint: form fields (`client_secret_post`) or HTTP Basic. */
    clientAuth: z.enum(["body", "basic"]).default("body"),
    /** Requested scopes; `openid` and `email` are always sent. */
    scopes: z.array(z.string().regex(/^[\x21\x23-\x5b\x5d-\x7e]{1,128}$/, "must be a scope token")).default([]),
    /** Extra parameters of the authorize URL, e.g. `{ prompt: "select_account", hd: "example.com" }`. */
    authorizeParams: z.record(z.string().regex(/^[a-z_]{1,64}$/), z.string().max(512)).default({}),
    /** Who may sign in: a verified email in one of these domains. */
    allowedDomains: z.array(domainSchema).default([]),
    /** Who may sign in: one of these verified emails. */
    allowedEmails: z.array(adminEmailSchema).default([]),
    /**
     * A domain match also needs the token's `hd` claim to name that domain (a Google Workspace account). Defaults to
     * true for Google, whose consumer accounts can carry a verified address of any domain.
     */
    requireHostedDomain: z.boolean().optional(),
    /** A first sign-in of an allowed identity without an account creates one (no password); false only links. */
    createAccounts: z.boolean().default(true),
  })
  .transform((provider) => ({ ...provider, requireHostedDomain: provider.requireHostedDomain ?? provider.issuer === GOOGLE_ISSUER }))
  .refine((provider) => provider.allowedDomains.length + provider.allowedEmails.length > 0, {
    message: "needs allowedDomains or allowedEmails: an OpenID Connect sign-in is limited to them",
    path: ["allowedDomains"],
  });

export type OidcProviderInput = z.input<typeof oidcProviderSchema>;
export type OidcProvider = z.output<typeof oidcProviderSchema>;

export const authOptionsSchema = z.strictObject({
  password: z
    .strictObject({
      /**
       * The password form and routes (login, register, change, reset). False leaves OpenID Connect as the only way in:
       * the pages are not found and the server functions refuse.
       */
      enabled: z.boolean().default(true),
      /** Shortest password a user may set (characters). */
      minLength: z.number().int().min(8).max(128).default(10),
      /** Hash cost; memory per hash is 128 * cost * blockSize bytes. Raising it rehashes each password at its owner's next login. */
      scrypt: scryptSchema.prefault({}),
    })
    .prefault({}),
  session: z
    .strictObject({
      /** How long a session lasts from login; it is not extended by use. */
      ttlDays: z.number().int().min(1).max(365).default(30),
    })
    .prefault({}),
  cookie: z
    .strictObject({
      /** Base name; `__Host-` or `__Secure-` is added when the cookie is secure. */
      name: z.string().regex(COOKIE_NAME, "must be 1-64 letters, digits, _ or -").default(DEFAULT_COOKIE_NAME),
      /** Share the session with subdomains, e.g. `example.com` for the apex and `app.example.com`. */
      domain: z.string().regex(DOMAIN, "must be a lowercase host name such as example.com").optional(),
      /** Defaults to whether `appOrigin` is https. */
      secure: z.boolean().optional(),
    })
    .prefault({}),
  /**
   * Sessions of the system the app took over, so adopting the module does not log everyone out:
   * the cookie it set and the shape of its tokens, stored as the sha256 hex of the token like here.
   * Read when the current cookie is absent; ended and cleared at the next login, register or logout.
   */
  legacySession: z
    .strictObject({
      /** The old cookie's full name, prefix included. */
      cookieName: z.string().regex(LEGACY_COOKIE_NAME, "must be 1-128 letters, digits, _ . or -"),
      /** The whole token's shape, e.g. /[0-9a-f]{64}/; anchored by the module. */
      tokenPattern: z.custom<RegExp>(
        (value) => value instanceof RegExp && !value.global && !value.sticky,
        "must be a RegExp without the g or y flag",
      ),
    })
    .optional(),
  /**
   * Extra register form fields handed to `onRegistered` as `event.fields` (strings, at most 512
   * characters; empty ones are left out). `RegisterPage` carries a declared field from its URL as a
   * hidden input (e.g. `?z=` for a channel tag). Values come from the client: validate them in the hook.
   */
  registrationFields: z
    .array(
      z
        .string()
        .regex(REGISTRATION_FIELD_NAME, "must be a field name such as channel (a-z first, then letters, digits or _, at most 32)")
        .refine((name) => !REGISTER_FORM_FIELDS.has(name), "is a field of the register form itself"),
    )
    .refine((names) => new Set(names).size === names.length, "must not repeat a name")
    .default([]),
  /** Registration needs a ticked consent checkbox. */
  requireConsent: z.boolean().default(true),
  /** Declared default of the `auth.registration_closed` switch. */
  registrationClosed: z.boolean().default(false),
  /** Role names the app checks besides `admin`, which is always declared. */
  roles: z.array(z.string().regex(ROLE_NAME_PATTERN, "must be a role name such as editor (a-z, 0-9, _ or -, at most 32)")).default([]),
  /**
   * Initial admin list: while an email is listed, the account with that email holds `admin`.
   * Auth does not verify emails, so create these accounts before deploying the list.
   */
  adminEmails: z
    .union([z.array(adminEmailSchema), z.string().transform(parseAdminEmailList)], { error: "must be a list of email addresses or one string of them" })
    .default([]),
  passwordReset: z
    .strictObject({
      /** Delivers reset links. Without it password reset is off: no link, and its pages are not found. */
      send: z.custom<PasswordResetSender>((value) => typeof value === "function", "must be a function").optional(),
      /**
       * Sends the link from a background job instead of the request (`enqueuePasswordReset` of
       * `@softure-ai/auth/jobs`): the job's handler issues the link and calls `send`, with retry.
       */
      enqueue: z.custom<PasswordResetEnqueuer>((value) => typeof value === "function", "must be a function").optional(),
      /** How long a reset link works. */
      ttlMinutes: z.number().int().min(5).max(1440).default(60),
    })
    .prefault({}),
  /** Sign-in with OpenID Connect providers (e.g. Google), limited to allowed domains or emails. Off without providers. */
  oidc: z
    .strictObject({
      providers: z
        .array(oidcProviderSchema)
        .refine((providers) => new Set(providers.map((provider) => provider.id)).size === providers.length, "must not repeat a provider id")
        .default([]),
      /** How long a started sign-in may take at the provider. */
      stateTtlMinutes: z.number().int().min(1).max(60).default(10),
      /** Timeout of each call to a provider (discovery, keys, token). */
      httpTimeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
      /** The `fetch` the provider calls go through; tests pass a fake provider's. */
      fetch: z.custom<FetchFunction>((value) => typeof value === "function", "must be a function").optional(),
    })
    .prefault({}),
  /** Called after an account is created, in the same transaction (e.g. to store the consent). */
  onRegistered: z.custom<OnRegisteredHook>((value) => typeof value === "function", "must be a function").optional(),
  /** Rewrites the path of every auth redirect (e.g. `tagRedirect` from `@softure-ai/analytics/next`). */
  rewriteRedirect: z.custom<RewriteRedirect>((value) => typeof value === "function", "must be a function").optional(),
}).superRefine((options, context) => {
  if (options.passwordReset.enqueue !== undefined && options.passwordReset.send === undefined) {
    context.addIssue({ code: "custom", path: ["passwordReset", "enqueue"], message: "needs passwordReset.send, which the job calls" });
  }
  if (!options.password.enabled && options.oidc.providers.length === 0) {
    context.addIssue({ code: "custom", path: ["password", "enabled"], message: "needs an oidc provider: without passwords nobody could sign in" });
  }
  const legacy = options.legacySession?.cookieName;
  const base = options.cookie.name;
  if (legacy !== undefined && [base, `__Host-${base}`, `__Secure-${base}`].includes(legacy)) {
    context.addIssue({ code: "custom", path: ["legacySession", "cookieName"], message: "must differ from the current session cookie's name" });
  }
});

export type AuthOptionsInput = z.input<typeof authOptionsSchema>;
export type AuthOptions = z.output<typeof authOptionsSchema>;
export type ScryptParams = z.output<typeof scryptSchema>;
