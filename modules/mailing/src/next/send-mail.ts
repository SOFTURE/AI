// `sendMail` on the app's registered configuration, for server actions and route handlers.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { OutgoingMail, SendMailOptions, SendMailResult } from "../contract.js";
import { sendMail as sendMailWithContext } from "../server/send-mail.js";

/** Sends one mail with the registered config; see `sendMail` in `@softure-ai/mailing/server`. */
export async function sendMail(mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  return sendMailWithContext({ config: getSoftureConfig() }, mail, options);
}
