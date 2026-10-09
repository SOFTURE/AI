// The options an app passes to `security({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import type { ClientIpResolver } from "./client-ip.js";

const BUCKET_NAME = /^[a-z][a-z0-9_.-]{0,62}$/;
const MAX_LIMIT = 1_000_000;
const MAX_WINDOW_MINUTES = 7 * 24 * 60;

const RESOLVER_HINT = "must be a client-IP resolver or a non-empty list of them, e.g. cloudflareIp()";
const BUCKET_NAME_HINT = "is not a bucket name: lowercase letters, digits, _ . and -, starting with a letter";
const FALLBACK_KEY_HINT = "is not a fallback key: lowercase letters, digits, _ . and -, starting with a letter, at most 63";

function isResolverOrList(value: unknown): value is ClientIpResolver | readonly ClientIpResolver[] {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => typeof item === "function");
  }
  return typeof value === "function";
}

/**
 * What a bucket counts by: `"ip"` the client address (`identifyClient`), also when combined with
 * another value; `"account"` one account (its user id or its login email); `"subject"` any other value
 * passed through `subjectKey`. The limiter does not read it: it states the processing, e.g. which
 * buckets a privacy policy must name as IP-keyed (`listRateLimitBuckets`).
 */
export const RATE_LIMIT_KEY_KINDS = ["ip", "account", "subject"] as const;

export type RateLimitKeyKind = (typeof RATE_LIMIT_KEY_KINDS)[number];

const bucketSchema = z.strictObject({
  /** Attempts allowed per window; the next one is rejected. */
  limit: z.number().int().min(1).max(MAX_LIMIT),
  /** Length of the fixed window; the counter starts again when it ends. */
  windowMinutes: z.number().int().min(1).max(MAX_WINDOW_MINUTES),
  /** What the bucket counts by; optional, every package default declares it. */
  key: z.enum(RATE_LIMIT_KEY_KINDS).optional(),
});

export const securityOptionsSchema = z.strictObject({
  /** One resolver or several, tried in order; the first address found wins. */
  clientIp: z
    .custom<ClientIpResolver | readonly ClientIpResolver[]>(isResolverOrList, RESOLVER_HINT)
    .transform((value): readonly ClientIpResolver[] => (typeof value === "function" ? [value] : value)),
  /** Named rate limits. A name is lowercase: letters, digits, `_`, `.` and `-`. */
  buckets: z
    .record(z.string(), bucketSchema)
    .superRefine((buckets, context) => {
      const names = Object.keys(buckets);
      if (names.length === 0) {
        context.addIssue({ code: "custom", message: "must define at least one bucket" });
      }
      for (const name of names.filter((candidate) => !BUCKET_NAME.test(candidate))) {
        context.addIssue({ code: "custom", path: [name], message: BUCKET_NAME_HINT });
      }
    }),
  /**
   * What happens to a request no resolver identifies: `"refuse"` answers `security.client_unidentified`;
   * `{ key }` counts every such request under one shared key, `unidentified:<key>`.
   */
  unidentified: z
    .union([z.literal("refuse"), z.strictObject({ key: z.string().regex(BUCKET_NAME, FALLBACK_KEY_HINT) })])
    .default("refuse"),
  /** IPv6 clients are keyed by their network of this many bits. */
  ipv6Subnet: z.number().int().min(1).max(128).default(64),
  /** Chance that a consumed attempt also deletes expired rows. */
  cleanupProbability: z.number().min(0).max(1).default(0.01),
});

export type SecurityOptionsInput = z.input<typeof securityOptionsSchema>;
export type SecurityOptions = z.output<typeof securityOptionsSchema>;
export type RateLimitBucket = z.output<typeof bucketSchema>;
export type RateLimitBucketInput = z.input<typeof bucketSchema>;

/**
 * A copy of a package's bucket defaults with some thresholds changed, field by field, so the rest of
 * each bucket (its kind included) stays: `overrideBuckets(AUTH_RATE_LIMIT_BUCKETS, { login: { limit: 200 } })`.
 * Throws on a name the defaults lack: a typo would otherwise add a bucket nothing counts in.
 */
export function overrideBuckets<TBuckets extends Readonly<Record<string, RateLimitBucketInput>>>(
  defaults: TBuckets,
  overrides: { readonly [TName in keyof TBuckets]?: Partial<RateLimitBucketInput> },
): { [TName in keyof TBuckets]: RateLimitBucketInput } {
  const merged: Record<string, RateLimitBucketInput> = {};
  for (const [name, bucket] of Object.entries(defaults)) {
    merged[name] = { ...bucket };
  }
  for (const [name, override] of Object.entries(overrides as Readonly<Record<string, Partial<RateLimitBucketInput> | undefined>>)) {
    const bucket = Object.hasOwn(defaults, name) ? merged[name] : undefined;
    if (bucket === undefined) {
      throw new Error(`overrideBuckets: no bucket "${name}" in the defaults; known buckets: ${Object.keys(defaults).join(", ")}`);
    }
    merged[name] = { ...bucket, ...override };
  }
  // Every key of `defaults` was copied above, and overrides only replace existing keys.
  return merged as { [TName in keyof TBuckets]: RateLimitBucketInput };
}
