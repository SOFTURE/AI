// Saving a file from an https URL someone else chose (a document an assistant links to). The download goes through
// `@softure-ai/security`'s guarded download, so the URL and every redirect pass the SSRF guard, and its body streams
// straight into `saveFile`: the size cap, the quota, the dedupe and the expiry are the same as for any other save.
import { err, type Err, type Ok } from "@softure-ai/core";
import { downloadGuardedFile, type GuardedDownloadErrorCode, type GuardedRequestSeam } from "@softure-ai/security/server";
import type { FilesDownloadErrorCode, FilesSaveErrorCode, StoredFile } from "../contract.js";
import type { FilesContext } from "./context.js";
import { DEFAULT_CONTENT_TYPE, normalizeContentType } from "./names.js";
import { getFilesOptions } from "./options.js";
import { saveFile, validateFileDescription, type SaveFileResult } from "./save.js";
import { isContentTypeAllowed } from "./uploads.js";

/** The time limit of a download when the caller gives none: one minute, every redirect and the body included. */
export const SAVE_FROM_URL_DEFAULT_TIMEOUT_MS = 60_000;

/** The name of a file whose URL path ends in no file name. */
export const SAVE_FROM_URL_DEFAULT_NAME = "download";

export interface SaveFileFromUrlInput {
  readonly ownerId: string;
  /** An `https:` URL on the default port; every redirect must stay on `https:` too. */
  readonly url: string;
  /** The file's name; defaults to the last part of the final URL's path, else {@link SAVE_FROM_URL_DEFAULT_NAME}. */
  readonly name?: string;
  /** The media type to store; defaults to the one the server answered, else `application/octet-stream`. */
  readonly contentType?: string;
  /** The media types the file may have (`application/pdf`, `image/*`), checked before a byte is stored; any by default. */
  readonly contentTypes?: readonly string[];
  readonly kind?: string;
  readonly expiresAt?: Date;
  readonly ttlSeconds?: number;
  /** The longest the whole download may take, in milliseconds; {@link SAVE_FROM_URL_DEFAULT_TIMEOUT_MS} by default. */
  readonly timeoutMs?: number;
}

export type SaveFileFromUrlErrorCode = FilesSaveErrorCode | FilesDownloadErrorCode | "files.content_type_not_allowed";

export type SaveFileFromUrlResult = Ok<StoredFile> | Err<SaveFileFromUrlErrorCode>;

/** What `consume` hands back: the save's result, or the media type it refused before reading the body. */
type Consumed = { readonly kind: "saved"; readonly result: SaveFileResult } | { readonly kind: "type_refused" };

/** Only https on its default port: a document link never needs another, and other ports widen what the guard allows. */
const ALLOWED_PORTS: readonly number[] = [443];

/**
 * Downloads `url` through the guarded download and saves it for `ownerId` with `saveFile`. Refusals are codes: an URL
 * that is not https `files.url_not_allowed`, a private or loopback address `files.url_blocked`, a status other than 2xx
 * or a broken connection `files.download_failed`, past `timeoutMs` `files.download_timeout`, a media type outside
 * `contentTypes` `files.content_type_not_allowed`, over `maxFileBytes` `files.too_large`, and the save's own codes. A
 * storage failure propagates, as with `saveFile`; nothing of a refused file is kept.
 */
export async function saveFileFromUrl(ctx: FilesContext, input: SaveFileFromUrlInput, seam: GuardedRequestSeam = {}): Promise<SaveFileFromUrlResult> {
  const rules = input.contentTypes ?? null;
  const described = validateFileDescription({ ownerId: input.ownerId, name: input.name ?? SAVE_FROM_URL_DEFAULT_NAME, contentType: input.contentType, kind: input.kind });
  if (!described.ok) return described;
  if (input.contentType !== undefined && !isContentTypeAllowed(described.value.contentType, rules)) return err("files.content_type_not_allowed");
  if (!isHttpsUrl(input.url)) return err("files.url_not_allowed");
  const timeoutMs = input.timeoutMs ?? SAVE_FROM_URL_DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return err("files.invalid_input");

  const options = getFilesOptions(ctx.config);
  const downloaded = await downloadGuardedFile<Consumed>(
    input.url,
    { timeoutMs, maxBytes: options.maxFileBytes, requireHttps: true, allowedPorts: ALLOWED_PORTS, accept: rules === null ? "*/*" : rules.join(", ") },
    async (file) => {
      const contentType = input.contentType ?? normalizeContentType(file.contentType ?? DEFAULT_CONTENT_TYPE) ?? DEFAULT_CONTENT_TYPE;
      if (!isContentTypeAllowed(contentType, rules)) return { kind: "type_refused" };
      const result = await saveFile(ctx, {
        ownerId: input.ownerId,
        body: file.body,
        name: input.name ?? readFileName(file.finalUrl),
        contentType,
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
        ...(input.ttlSeconds === undefined ? {} : { ttlSeconds: input.ttlSeconds }),
      });
      return { kind: "saved", result };
    },
    seam,
  );
  if (!downloaded.ok) return err(toDownloadError(downloaded.error));
  if (!downloaded.value.consumed) return err("files.download_failed");
  const consumed = downloaded.value.value;
  return consumed.kind === "saved" ? consumed.result : err("files.content_type_not_allowed");
}

function toDownloadError(code: GuardedDownloadErrorCode): FilesDownloadErrorCode | "files.too_large" {
  switch (code) {
    case "security.outbound_invalid_url":
      return "files.url_not_allowed";
    case "security.outbound_blocked":
      return "files.url_blocked";
    case "security.outbound_timeout":
      return "files.download_timeout";
    case "security.outbound_too_large":
      return "files.too_large";
    case "security.outbound_failed":
      return "files.download_failed";
  }
}

/** An `https:` URL on the default port; the guard checks it again, and every redirect, on the way. */
function isHttpsUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && url.port === "";
}

/** The last part of the URL's path, decoded; {@link SAVE_FROM_URL_DEFAULT_NAME} when it has none. */
function readFileName(url: string): string {
  const last = new URL(url).pathname.split("/").at(-1) ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    decoded = last;
  }
  return decoded.trim() === "" ? SAVE_FROM_URL_DEFAULT_NAME : decoded;
}
