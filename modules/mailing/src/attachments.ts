// The rules for mail attachments: the default limits and allow-list, the filename and content type checks, and the
// summary that stands in for an attachment wherever the bytes must not go (logs, dry runs, an app's records).
import type { AttachmentSummary, MailAttachment } from "./contract.js";

/** Files per mail when `attachments.maxCount` is not set. */
export const DEFAULT_MAX_ATTACHMENTS = 10;

/**
 * The most raw bytes all attachments of one mail may hold, and the default. Base64 grows them by a third on the
 * wire: 28,000,000 bytes encode to about 37.3 MB, under the 40 MB a mail may have at Resend and similar providers,
 * with room for the bodies. `attachments.maxTotalBytes` can only lower it.
 */
export const MAX_ATTACHMENT_BYTES = 28_000_000;

/**
 * The content types allowed when `attachments.contentTypes` is not set: documents, data exports, images and calendar
 * invites. HTML, SVG, scripts and executables are left out: a mail client may run or render them.
 */
export const DEFAULT_ATTACHMENT_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/calendar",
  "application/json",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

export const MAX_ATTACHMENT_FILENAME_LENGTH = 255;

/** The limits a mail's attachments are checked against (`mailing({ attachments })`, resolved). */
export interface AttachmentLimits {
  readonly maxCount: number;
  readonly maxTotalBytes: number;
  /** Lowercase `type/subtype` values. */
  readonly contentTypes: readonly string[];
}

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
  maxCount: DEFAULT_MAX_ATTACHMENTS,
  maxTotalBytes: MAX_ATTACHMENT_BYTES,
  contentTypes: DEFAULT_ATTACHMENT_CONTENT_TYPES,
};

const TOKEN = "[A-Za-z0-9!#$&^_.+-]+";
const CONTENT_TYPE = new RegExp(`^${TOKEN}/${TOKEN}(\\s*;\\s*${TOKEN}=("[^"\\r\\n]*"|${TOKEN}))*$`);

/** A plain filename: 1 to 255 characters, not blank, no `/` or `\`, no control characters, not `.` or `..`. */
export function isAttachmentFilename(value: string): boolean {
  return (
    value.trim() !== "" &&
    value.length <= MAX_ATTACHMENT_FILENAME_LENGTH &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !hasControlCharacter(value) &&
    value !== "." &&
    value !== ".."
  );
}

/** A C0 control character or DEL. */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** A MIME type `type/subtype`, optionally with parameters (`text/csv; charset=utf-8`). */
export function isContentType(value: string): boolean {
  return CONTENT_TYPE.test(value);
}

/** The `type/subtype` of a content type, lowercase, without its parameters. */
export function getContentTypeEssence(value: string): string {
  return (value.split(";")[0] ?? "").trim().toLowerCase();
}

/** Every attachment without its bytes: filename, content type and size. Safe to keep in an app's own records. */
export function describeAttachments(attachments: readonly MailAttachment[]): AttachmentSummary[] {
  return attachments.map(({ filename, contentType, content }) => ({ filename, contentType, size: content.byteLength }));
}
