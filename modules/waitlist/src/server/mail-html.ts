// The HTML body of a waitlist mail: the app's `mailTemplate` when it set one, else the module's
// default body built from the same copy as the text body.
import type { SoftureConfig } from "@softure-ai/core";
import {
  renderDefaultMailBody,
  splitParagraphs,
  type ConfirmationMailTemplateInput,
  type WelcomeMailTemplateInput,
} from "../mail-template.js";
import { getWaitlistOptions } from "./options.js";

/** A mail to render: its copy text and, for the confirmation mail, the link; the body is derived. */
export type MailHtmlInput =
  | (Pick<WelcomeMailTemplateInput, "kind" | "locale" | "subject"> & { readonly text: string })
  | (Pick<ConfirmationMailTemplateInput, "kind" | "locale" | "subject" | "action"> & { readonly text: string });

/**
 * The HTML body of `mail`. Throws when the app's template returns blank HTML: that is a bug in the
 * app, and mailing would refuse the mail without saying why.
 */
export function renderMailHtml(config: SoftureConfig, mail: MailHtmlInput): string {
  const { text, ...rest } = mail;
  const paragraphs = splitParagraphs(text);
  const body = renderDefaultMailBody(paragraphs, rest.kind === "confirmation" ? rest.action : null);
  const template = getWaitlistOptions(config).mailTemplate;
  if (template === undefined) return body;
  const html = template({ ...rest, paragraphs, body });
  if (typeof html !== "string" || html.trim() === "") {
    throw new Error(`@softure-ai/waitlist: mailTemplate returned no HTML for the ${rest.kind} mail; return a non-empty string`);
  }
  return html;
}
