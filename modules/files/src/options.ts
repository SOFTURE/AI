// The options an app passes to `files({ ... })` in softure.config.ts, parsed at startup. The storage driver is an
// object the app builds (`createLocalStorage`, `createS3Storage`); building one touches neither the disk nor the
// network, so `next build` runs without the folder or the bucket's secrets.
import { z } from "zod";
import { isFileStorage, type FileStorage } from "./storage.js";

const MIB = 1024 * 1024;
const DAY_SECONDS = 24 * 60 * 60;

/** A file kind: lowercase letters, digits, `_` and `-`, starting with a letter, at most 32 characters. */
export const FILE_KIND_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
/** The kind of a file saved without one. */
export const DEFAULT_FILE_KIND = "file";

export const filesOptionsSchema = z.strictObject({
  /** Where the bytes live: `createLocalStorage({ dir })`, `createS3Storage({ ... })` or `createMemoryStorage()`. */
  storage: z.custom<FileStorage>(isFileStorage, "must be a storage driver such as createLocalStorage({ dir })"),
  /** The largest file `saveFile` accepts. */
  maxFileBytes: z
    .number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .default(100 * MIB),
  /** The bytes one owner may keep in live files; null: no quota. */
  quotaBytesPerOwner: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable().default(null),
  /** Saving content an owner already has (same SHA-256) answers the existing file instead of a second copy. */
  dedupe: z.boolean().default(false),
  /** The lifetime of a file saved without `expiresAt` or `ttlSeconds`; null: kept until deleted. */
  defaultTtlSeconds: z
    .number()
    .int()
    .min(60)
    .max(3650 * DAY_SECONDS)
    .nullable()
    .default(null),
  links: z
    .strictObject({
      /** The longest lifetime `createFileLink` grants. */
      maxTtlSeconds: z
        .number()
        .int()
        .min(60)
        .max(365 * DAY_SECONDS)
        .default(7 * DAY_SECONDS),
      /** How a link hands the file over: a download (`attachment`) or shown in the browser (`inline`). */
      disposition: z.enum(["attachment", "inline"]).default("attachment"),
    })
    .default({ maxTtlSeconds: 7 * DAY_SECONDS, disposition: "attachment" }),
  health: z
    .strictObject({
      /** Below this many free bytes (when the driver can tell) the health check fails. */
      minFreeBytes: z
        .number()
        .int()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER)
        .default(1024 * MIB),
    })
    .default({ minFreeBytes: 1024 * MIB }),
});

export type FilesOptionsInput = z.input<typeof filesOptionsSchema>;
export type FilesOptions = z.output<typeof filesOptionsSchema>;
