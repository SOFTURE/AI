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

const bucketSchema = z.strictObject({
  /** Attempts allowed per window; the next one is rejected. */
  limit: z.number().int().min(1).max(MAX_LIMIT),
  /** Length of the fixed window; the counter starts again when it ends. */
  windowMinutes: z.number().int().min(1).max(MAX_WINDOW_MINUTES),
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
