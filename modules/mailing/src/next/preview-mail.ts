// `previewMail` on the app's registered configuration, e.g. for an admin page that shows a mail before it goes out.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { OutgoingMail } from "../contract.js";
import { previewMail as previewMailWithConfig, type MailPreviewResult, type PreviewMailOptions } from "../server/send-mail.js";

/** What `sendMail` would hand the provider for `mail`; see `previewMail` in `@softure-ai/mailing/server`. */
export function previewMail(mail: OutgoingMail, options: PreviewMailOptions = {}): MailPreviewResult {
  return previewMailWithConfig(getSoftureConfig(), mail, options);
}
