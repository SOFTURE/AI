// What an operator's terminal may show of a mail: addresses masked, link signatures redacted. Command output ends
// up in shell history, CI logs and pasted chat messages; a full address is personal data, and a signed unsubscribe
// link lets whoever holds it unsubscribe that address.
import { SIGNATURE_PARAM } from "./unsubscribe-link.js";

/** `ada@example.org` becomes `a**@example.org`: the first character of the local part, then one `*` per other. */
export function maskAddress(address: string): string {
  const trimmed = address.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return "*".repeat(Math.max(trimmed.length, 1));
  const local = trimmed.slice(0, at);
  return `${local.slice(0, 1)}${"*".repeat(local.length - 1)}${trimmed.slice(at)}`;
}

const SIGNATURE = new RegExp(`([?&](?:amp;)?${SIGNATURE_PARAM}=)[A-Za-z0-9_-]+`, "g");

/** `text` with the signature of every unsubscribe link replaced by `<signature>`, so the link no longer works. */
export function redactUnsubscribeSignatures(text: string): string {
  return text.replace(SIGNATURE, "$1<signature>");
}
