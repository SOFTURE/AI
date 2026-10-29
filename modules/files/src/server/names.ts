// Names and media types that come from users, made safe to store and to send back in a header or a URL.

const MAX_NAME_LENGTH = 255;
const FALLBACK_NAME = "file";
/** `type/subtype` with optional parameters, as the table's check allows. */
const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(;[ -~]*)?$/;
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * The last path part of `name` without control characters, slashes or backslashes, trimmed and at most 255
 * characters (by code point); `file` when nothing is left.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).at(-1) ?? "";
  // eslint-disable-next-line no-control-regex -- control characters are exactly what the name must not carry
  const cleaned = base.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  const clipped = [...cleaned].slice(0, MAX_NAME_LENGTH).join("").trim();
  return clipped === "" || clipped === "." || clipped === ".." ? FALLBACK_NAME : clipped;
}

/** The media type with its type and subtype lowercased, or null when it is not one the table accepts. */
export function normalizeContentType(contentType: string): string | null {
  const trimmed = contentType.trim();
  const separator = trimmed.indexOf(";");
  const essence = (separator === -1 ? trimmed : trimmed.slice(0, separator)).trim().toLowerCase();
  const normalized = separator === -1 ? essence : `${essence}${trimmed.slice(separator)}`;
  return normalized.length <= 255 && CONTENT_TYPE_PATTERN.test(normalized) ? normalized : null;
}

/** A `Content-Disposition` value with an ASCII fallback name and the UTF-8 name (RFC 6266, RFC 8187). */
export function formatContentDisposition(disposition: "attachment" | "inline", name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
