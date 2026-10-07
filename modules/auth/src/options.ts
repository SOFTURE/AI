// The options an app passes to `auth({ ... })` in softure.config.ts, parsed at startup.
import type { ModuleContext, SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { z } from "zod";
import type { RegisteredEvent } from "./contract.js";
import type { PasswordResetSender } from "./password-reset-sender.js";
import { ROLE_NAME_PATTERN } from "./roles.js";

/** OWASP's scrypt cost for passwords: N = 2^17, r = 8, p = 1 (about 128 MiB per hash). */
export const DEFAULT_SCRYPT_COST = 2 ** 17;

const MAX_EMAIL_LENGTH = 254;
const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
/** A legacy cookie may carry its own prefix (`__Host-session`) or a dot. */
const LEGACY_COOKIE_NAME = /^[A-Za-z0-9_.-]{1,128}$/;
const DEFAULT_COOKIE_NAME = "softure_session";
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

export const authOptionsSchema = z.strictObject({
  password: z
    .strictObject({
      /** Shortest password a user may set (characters). */
      minLength: z.number().int().min(8).max(128).default(10),
      /** Hash cost. Raising it rehashes each password at its owner's next login. */
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
  adminEmails: z.array(z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).pipe(z.email("must be an email address"))).default([]),
  passwordReset: z
    .strictObject({
      /** Delivers reset links. Without it password reset is off: no link, and its pages are not found. */
      send: z.custom<PasswordResetSender>((value) => typeof value === "function", "must be a function").optional(),
      /** How long a reset link works. */
      ttlMinutes: z.number().int().min(5).max(1440).default(60),
    })
    .prefault({}),
  /** Called after an account is created, in the same transaction (e.g. to store the consent). */
  onRegistered: z.custom<OnRegisteredHook>((value) => typeof value === "function", "must be a function").optional(),
  /** Rewrites the path of every auth redirect (e.g. `tagRedirect` from `@softure-ai/analytics/next`). */
  rewriteRedirect: z.custom<RewriteRedirect>((value) => typeof value === "function", "must be a function").optional(),
}).superRefine((options, context) => {
  const legacy = options.legacySession?.cookieName;
  const base = options.cookie.name;
  if (legacy !== undefined && [base, `__Host-${base}`, `__Secure-${base}`].includes(legacy)) {
    context.addIssue({ code: "custom", path: ["legacySession", "cookieName"], message: "must differ from the current session cookie's name" });
  }
});

export type AuthOptionsInput = z.input<typeof authOptionsSchema>;
export type AuthOptions = z.output<typeof authOptionsSchema>;
export type ScryptParams = z.output<typeof scryptSchema>;
