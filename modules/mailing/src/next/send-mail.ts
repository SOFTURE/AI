// `sendMail` on the app's registered configuration and shared database handle, for server actions
// and route handlers.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { OutgoingMail, SendMailOptions, SendMailResult } from "../contract.js";
import { sendMail as sendMailWithContext } from "../server/send-mail.js";
import { getMailingContext } from "./context.js";

/** Sends one mail with the registered config; see `sendMail` in `@softure-ai/mailing/server`. */
export async function sendMail(mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  const { config, db } = await getMailingContext(getSoftureConfig());
  return sendMailWithContext({ config, db }, mail, options);
}
