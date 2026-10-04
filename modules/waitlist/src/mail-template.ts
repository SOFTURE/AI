// The HTML bodies of the waitlist's mails. The module builds a plain body from the same copy as the
// text body; an app replaces it with `waitlist({ mailTemplate })`, a function that gets the copy,
// the link and that default body and returns the HTML (a fragment or a whole document; mailing adds
// its unsubscribe footer to either).
import type { Locale } from "@softure-ai/core";

interface MailTemplateInputBase {
  /** The language of the copy: the sign-up's locale. */
  readonly locale: Locale;
  readonly subject: string;
  /** The copy's paragraphs as plain text (not escaped; use `escapeHtml` before putting them in HTML). */
  readonly paragraphs: readonly string[];
  /** The module's default HTML body: the paragraphs escaped and, with a link, its anchor. */
  readonly body: string;
}

/** The welcome mail, list mail: mailing appends its unsubscribe footer to the HTML returned. */
export interface WelcomeMailTemplateInput extends MailTemplateInputBase {
  readonly kind: "welcome";
}

/** The confirmation mail of double opt-in: `action` is the single-use link and its label. */
export interface ConfirmationMailTemplateInput extends MailTemplateInputBase {
  readonly kind: "confirmation";
  readonly action: { readonly href: string; readonly label: string };
}

export type WaitlistMailTemplateInput = WelcomeMailTemplateInput | ConfirmationMailTemplateInput;

/**
 * Renders the HTML body of a waitlist mail, e.g. `({ body }) => brandLayout(body)`. It must return
 * non-blank HTML; a template that throws or returns nothing is a bug and the mail is not sent.
 */
export type WaitlistMailTemplate = (mail: WaitlistMailTemplateInput) => string;

const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** `text` safe inside HTML text and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/** The paragraphs of a copy text: blocks separated by a blank line, trimmed, empty ones dropped. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

/** The default body: each paragraph escaped in `<p>` (a line break as `<br>`), then the link's anchor. */
export function renderDefaultMailBody(paragraphs: readonly string[], action: ConfirmationMailTemplateInput["action"] | null): string {
  const blocks = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`);
  if (action !== null) blocks.push(`<p><a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a></p>`);
  return blocks.join("\n");
}
