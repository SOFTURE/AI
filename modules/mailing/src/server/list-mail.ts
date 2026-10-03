// The footer and headers every list mail carries. Ported from FIRE_TRACKER
// `src/lib/unsubscribe-footer.ts`: one footer and one header pair for all list mail, so no kind of
// mail can lose its link while its own tests stay green. HTML bodies get a footer too.
import type { MailingMessages } from "../messages/index.js";
import type { UnsubscribeLinks } from "./unsubscribe-link.js";

/** The signature separator (RFC 3676): mail clients fold what follows it. */
export const SIGNATURE_SEPARATOR = "-- ";

type FooterCopy = MailingMessages["footer"];

/** `text` with the unsubscribe footer under the signature separator. */
export function addTextFooter(text: string, links: UnsubscribeLinks, copy: FooterCopy): string {
  return [text, "", SIGNATURE_SEPARATOR, copy.text, links.page].join("\n");
}

/**
 * `html` with an unsubscribe paragraph before its last `</body>`, or appended when it has none
 * (a fragment). The copy is escaped; the link is ours and only needs its `&` escaped.
 */
export function addHtmlFooter(html: string, links: UnsubscribeLinks, copy: FooterCopy): string {
  const footer = `<p>${escapeHtml(copy.htmlLead)} <a href="${escapeHtml(links.page)}">${escapeHtml(copy.htmlLink)}</a></p>`;
  const bodyEnd = html.toLowerCase().lastIndexOf("</body>");
  return bodyEnd === -1 ? `${html}\n${footer}` : `${html.slice(0, bodyEnd)}${footer}\n${html.slice(bodyEnd)}`;
}

/**
 * RFC 8058: the mail client shows "Unsubscribe" next to the sender and POSTs to this URL itself,
 * without opening a page or a session. Both headers must be covered by the DKIM signature, which
 * the provider applies to every header it sends.
 */
export function getListUnsubscribeHeaders(links: UnsubscribeLinks): Record<string, string> {
  return {
    "List-Unsubscribe": `<${links.oneClick}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
