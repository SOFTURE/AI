// Address and header rules shared by the options schema and the mail validation.

/**
 * One address: an `@`, a dot-separated domain, no list separators, no whitespace, no angle
 * brackets. Each part excludes its own separator, so matching stays linear on any input.
 */
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>".]+(?:\.[^\s@,;<>".]+)+$/;

/**
 * A display name: no commas, semicolons or quotes. Unquoted, RFC 5322 reads a comma as a second
 * address, and quoting is left out on purpose.
 */
const DISPLAY_NAME = /^[^<>",;\r\n]+$/;

/** The longest address SMTP carries (RFC 5321 path limit). */
export const MAX_ADDRESS_LENGTH = 254;

/** RFC 5322 field name: printable ASCII except the colon. */
const HEADER_NAME = /^[!-9;-~]+$/;

/**
 * Headers that would take over the envelope, the sender or the body's encoding. The `headers`
 * field is for list headers (RFC 8058) and similar; a different `From:` fails DMARC, an added
 * recipient is mail nobody asked for.
 */
export const RESERVED_HEADERS: ReadonlySet<string> = new Set([
  "from",
  "sender",
  "to",
  "cc",
  "bcc",
  "reply-to",
  "subject",
  "return-path",
  "content-type",
  "content-transfer-encoding",
  "mime-version",
]);

/**
 * Headers the module writes on every list mail. A list mail that brings its own is refused: two
 * `List-Unsubscribe` headers, one of them unsigned, is worse than none.
 */
export const LIST_MAIL_HEADERS: ReadonlySet<string> = new Set(["list-unsubscribe", "list-unsubscribe-post"]);

/** A mail kind: kebab-case, 1 to 64 characters, e.g. `newsletter`. */
const MAIL_KIND = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const MAX_MAIL_KIND_LENGTH = 64;

export const MAX_SUBJECT_LENGTH = 998;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

export function isSingleAddress(value: string): boolean {
  return value.length <= MAX_ADDRESS_LENGTH && ADDRESS.test(value);
}

/** `addr` or `Name <addr>`, on one line. */
export function isMailbox(value: string): boolean {
  if (hasLineBreak(value)) return false;
  if (!value.endsWith(">")) return isSingleAddress(value);
  const open = value.lastIndexOf("<");
  const name = value.slice(0, Math.max(open, 0)).trim();
  return open > 0 && name !== "" && DISPLAY_NAME.test(name) && isSingleAddress(value.slice(open + 1, -1));
}

export function hasLineBreak(value: string): boolean {
  return /[\r\n]/.test(value);
}

export function isHeaderName(name: string): boolean {
  return HEADER_NAME.test(name);
}

export function isReservedHeader(name: string): boolean {
  return RESERVED_HEADERS.has(name.toLowerCase());
}

export function isListMailHeader(name: string): boolean {
  return LIST_MAIL_HEADERS.has(name.toLowerCase());
}

export function isMailKind(kind: string): boolean {
  return kind.length <= MAX_MAIL_KIND_LENGTH && MAIL_KIND.test(kind);
}

/** 1 to 256 visible ASCII characters. */
export function isIdempotencyKey(key: string): boolean {
  return key.length <= MAX_IDEMPOTENCY_KEY_LENGTH && /^[!-~]+$/.test(key);
}
