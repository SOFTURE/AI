// The options an app passes to `auth({ ... })` in softure.config.ts, parsed at startup.
import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { z } from "zod";
import type { RegisteredEvent } from "./contract.js";
import { ROLE_NAME_PATTERN } from "./roles.js";

/** OWASP's scrypt cost for passwords: N = 2^17, r = 8, p = 1 (about 128 MiB per hash). */
export const DEFAULT_SCRYPT_COST = 2 ** 17;

const MAX_EMAIL_LENGTH = 254;
const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const DOMAIN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Runs inside the registration transaction; a thrown error rolls the registration back. */
export type OnRegisteredHook = (event: RegisteredEvent, ctx: ModuleContext<Queryable>) => Promise<void>;

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
      name: z.string().regex(COOKIE_NAME, "must be 1-64 letters, digits, _ or -").default("softure_session"),
      /** Share the session with subdomains, e.g. `example.com` for the apex and `app.example.com`. */
      domain: z.string().regex(DOMAIN, "must be a lowercase host name such as example.com").optional(),
      /** Defaults to whether `appOrigin` is https. */
      secure: z.boolean().optional(),
    })
    .prefault({}),
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
  /** Called after an account is created, in the same transaction (e.g. to store the consent). */
  onRegistered: z.custom<OnRegisteredHook>((value) => typeof value === "function", "must be a function").optional(),
});

export type AuthOptionsInput = z.input<typeof authOptionsSchema>;
export type AuthOptions = z.output<typeof authOptionsSchema>;
export type ScryptParams = z.output<typeof scryptSchema>;
