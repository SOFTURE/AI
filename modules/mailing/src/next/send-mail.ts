// `sendMail` on the app's registered configuration, for server actions and route handlers. List
// mail also gets the shared database handle (its suppression check); transactional mail never
// touches the database.
import { getSoftureConfig } from "@softure-ai/core/next";
import { TRANSACTIONAL_KIND, type OutgoingMail, type SendMailOptions, type SendMailResult } from "../contract.js";
import { sendMail as sendMailWithContext } from "../server/send-mail.js";
import { getMailingContext } from "./context.js";

/** Sends one mail with the registered config; see `sendMail` in `@softure-ai/mailing/server`. */
export async function sendMail(mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  const config = getSoftureConfig();
  if ((mail.kind ?? TRANSACTIONAL_KIND) === TRANSACTIONAL_KIND) return sendMailWithContext({ config }, mail, options);
  const { db } = await getMailingContext(config);
  return sendMailWithContext({ config, db }, mail, options);
}
