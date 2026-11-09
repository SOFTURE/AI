// The off-site settings, read only from the environment and validated with zod. A host that sets none of the names
// is "not configured" (the step is skipped, never failed); one that sets some gets a list of what is missing or
// wrong, never a value. Two tokens: the nightly upload needs only a write token, restore and verify a read one.
import { z } from "zod";

/** The names the nightly upload reads (`.env.prod` on the server). */
export const UPLOAD_ENV_NAMES = [
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_REGION",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_PREFIX",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
  "BACKUP_AGE_RECIPIENT",
] as const;

/** The names restore, fetch and verify read (the operator's machine or a CI job, never the server). */
export const READ_ENV_NAMES = [
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_REGION",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_PREFIX",
  "BACKUP_S3_READ_ACCESS_KEY_ID",
  "BACKUP_S3_READ_SECRET_ACCESS_KEY",
] as const;

/** The secret names: their values are redacted from every message. */
export const SECRET_ENV_NAMES = [
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
  "BACKUP_S3_READ_ACCESS_KEY_ID",
  "BACKUP_S3_READ_SECRET_ACCESS_KEY",
] as const;

export const DEFAULT_REGION = "auto";
/** A prefix is path segments of lower-case letters, digits, `.`, `_` and `-`, so a key can never climb out of it. */
const PREFIX_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;
/** S3 bucket names: 3 to 63 lower-case letters, digits, `.` and `-`. */
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION_PATTERN = /^[a-z0-9-]{1,32}$/;
/** An age X25519 recipient (`age1` and 58 bech32 characters) or a hybrid post-quantum one (`age1pq1…`). */
const RECIPIENT_PATTERN = /^age1(pq1)?[02-9ac-hj-np-z]{40,}$/;

/** Where the objects go: the same for the write and the read side. */
export interface StoreConfig {
  readonly endpoint: URL;
  readonly region: string;
  readonly bucket: string;
  readonly prefix: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface UploadConfig {
  readonly store: StoreConfig;
  readonly recipient: string;
}

export type ConfigResult<T> =
  | { readonly status: "ok"; readonly config: T }
  | { readonly status: "not_configured" }
  | { readonly status: "invalid"; readonly problems: readonly string[] };

type Env = Readonly<Record<string, string | undefined>>;

const endpointSchema = z
  .string()
  .refine((value) => URL.canParse(value), "is not a URL")
  .transform((value) => new URL(value))
  .refine((url) => url.protocol === "https:" || url.protocol === "http:", "must start with https:// (or http:// for a local MinIO)")
  .refine((url) => url.username === "" && url.password === "", "must not carry a user or password")
  .refine((url) => url.search === "" && url.hash === "", "must not carry a query or fragment");

function storeSchema(keyName: string, secretName: string) {
  return z.object({
    BACKUP_S3_ENDPOINT: endpointSchema,
    BACKUP_S3_REGION: z.string().regex(REGION_PATTERN, "is not a region name").default(DEFAULT_REGION),
    BACKUP_S3_BUCKET: z.string().regex(BUCKET_PATTERN, "is not an S3 bucket name"),
    BACKUP_S3_PREFIX: z.string().regex(PREFIX_PATTERN, "is not a key prefix (lower-case path segments)").optional(),
    [keyName]: z.string().min(1, "is empty").max(256, "is too long"),
    [secretName]: z.string().min(1, "is empty").max(256, "is too long"),
  });
}

/** Unset and empty values count as unset; values are trimmed of surrounding blanks a secret store may add. */
function readNames(env: Env, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = env[name]?.trim();
    if (value !== undefined && value !== "") values[name] = value;
  }
  return values;
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const name = String(issue.path[0] ?? "configuration");
    return issue.code === "invalid_type" ? `${name} is not set` : `${name} ${issue.message}`;
  });
}

function toStore(values: Record<string, unknown>, keyName: string, secretName: string, defaultPrefix: string): StoreConfig {
  return {
    endpoint: values.BACKUP_S3_ENDPOINT as URL,
    region: values.BACKUP_S3_REGION as string,
    bucket: values.BACKUP_S3_BUCKET as string,
    prefix: (values.BACKUP_S3_PREFIX as string | undefined) ?? defaultPrefix,
    accessKeyId: values[keyName] as string,
    secretAccessKey: values[secretName] as string,
  };
}

function checkPrefix(prefix: string): string | null {
  return PREFIX_PATTERN.test(prefix) ? null : `the app name ${JSON.stringify(prefix)} is not a key prefix; set BACKUP_S3_PREFIX`;
}

/**
 * The upload settings of the nightly run. `appName` is the default prefix (each app its own folder of a shared
 * bucket); `BACKUP_S3_PREFIX` overrides it. Without `BACKUP_S3_BUCKET` and every other name, not configured.
 */
export function readUploadConfig(env: Env, appName: string): ConfigResult<UploadConfig> {
  const values = readNames(env, UPLOAD_ENV_NAMES);
  if (Object.keys(values).length === 0) return { status: "not_configured" };
  const schema = storeSchema("BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY").extend({
    BACKUP_AGE_RECIPIENT: z.string().regex(RECIPIENT_PATTERN, "is not an age public key (age1…)"),
  });
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "invalid", problems: describeIssues(parsed.error) };
  const store = toStore(parsed.data, "BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY", appName);
  const prefixProblem = checkPrefix(store.prefix);
  if (prefixProblem !== null) return { status: "invalid", problems: [prefixProblem] };
  return { status: "ok", config: { store, recipient: values.BACKUP_AGE_RECIPIENT ?? "" } };
}

/** The read settings of restore, fetch and verify: the same store with the read token. */
export function readReadConfig(env: Env, appName: string): ConfigResult<StoreConfig> {
  const values = readNames(env, READ_ENV_NAMES);
  if (Object.keys(values).length === 0) return { status: "not_configured" };
  const parsed = storeSchema("BACKUP_S3_READ_ACCESS_KEY_ID", "BACKUP_S3_READ_SECRET_ACCESS_KEY").safeParse(values);
  if (!parsed.success) return { status: "invalid", problems: describeIssues(parsed.error) };
  const store = toStore(parsed.data, "BACKUP_S3_READ_ACCESS_KEY_ID", "BACKUP_S3_READ_SECRET_ACCESS_KEY", appName);
  const prefixProblem = checkPrefix(store.prefix);
  if (prefixProblem !== null) return { status: "invalid", problems: [prefixProblem] };
  return { status: "ok", config: store };
}

/** The non-empty values of the secret names, for `redactSecrets`. */
export function collectSecrets(env: Env): string[] {
  return SECRET_ENV_NAMES.map((name) => env[name]?.trim() ?? "").filter((value) => value.length >= 4);
}

/** `text` with every secret value replaced by `***`. */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  let redacted = text;
  for (const secret of secrets) redacted = redacted.split(secret).join("***");
  return redacted;
}
