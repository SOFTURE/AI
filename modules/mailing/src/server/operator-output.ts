// What an operator's terminal may show of a mail: addresses masked, link signatures redacted. Command output ends
// up in shell history, CI logs and pasted chat messages; a full address is personal data, and a signed unsubscribe
// link lets whoever holds it unsubscribe that address.
import { describeAttachments } from "../attachments.js";
import type { ProviderMessage } from "../contract.js";
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

/**
 * A mail as the provider would get it (`previewMail`'s value), as terminal lines: the addresses masked, link
 * signatures redacted, and each attachment by filename, content type and size, never its bytes.
 */
export function formatMailPreview(message: ProviderMessage): string[] {
  const headers = [
    `From: ${message.from}`,
    `To: ${maskAddress(message.to)}`,
    ...(message.replyTo === null ? [] : [`Reply-To: ${maskAddress(message.replyTo)}`]),
    `Subject: ${message.subject}`,
    ...Object.entries(message.headers).map(([name, value]) => `${name}: ${value}`),
  ];
  const sections = [`--- preview (addresses masked, link signatures redacted) ---`, ...headers, "", "--- text ---", message.text];
  if (message.html !== null) sections.push("--- html ---", message.html);
  const attachments = describeAttachments(message.attachments ?? []);
  if (attachments.length > 0) {
    sections.push("--- attachments ---", ...attachments.map(({ filename, contentType, size }) => `${filename} (${contentType}, ${String(size)} bytes)`));
  }
  sections.push("--- end of preview ---");
  return redactUnsubscribeSignatures(sections.join("\n")).split("\n");
}
